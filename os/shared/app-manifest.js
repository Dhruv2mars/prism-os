/* Prism app manifest — schema, validator, and the permission catalogue.
 *
 * A manifest is the whole contract between a third-party app and the OS. It is
 * validated at install time, not at launch time, so a wearer never installs
 * something that will fail in their face later. Every rejection below names the
 * offending field and what was expected, because a developer reading "invalid
 * manifest" learns nothing.
 */

export const MANIFEST_VERSION = 1;

/* Every capability the OS will broker, with the wording the wearer sees.
   `reason` is supplied by the app; `why` is the OS's own plain-language
   explanation of the risk, so a wearer is never asked to trust app copy alone. */
export const PERMISSIONS = {
  location: {
    label: 'Location',
    why: 'Can see where you are, including when the app is in the background.',
    risk: 'high',
  },
  notifications: {
    label: 'Notifications',
    why: 'Can interrupt your view with a message.',
    risk: 'medium',
  },
  network: {
    label: 'Network',
    why: 'Can send and receive data over the internet.',
    risk: 'medium',
  },
  storage: {
    label: 'On-device storage',
    why: 'Can keep data on your glasses between sessions.',
    risk: 'low',
  },
  camera: {
    label: 'Camera',
    why: 'Can see what you see. The capture light is always on while in use.',
    risk: 'high',
  },
  microphone: {
    label: 'Microphone',
    why: 'Can hear you and your surroundings.',
    risk: 'high',
  },
};

export const CATEGORIES = ['utility', 'travel', 'fitness', 'productivity', 'media', 'social'];

const ID_RE = /^[a-z][a-z0-9-]{2,31}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function fail(errors, field, message) {
  errors.push({ field, message });
}

/* Returns { valid, errors, warnings, manifest }. Never throws: an install flow
   needs to render every problem at once, not stop at the first one. */
export function validateManifest(raw) {
  const errors = [];
  const warnings = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: [{ field: '(root)', message: 'Manifest must be a JSON object.' }], warnings, manifest: null };
  }

  if (raw.manifestVersion !== MANIFEST_VERSION) {
    fail(errors, 'manifestVersion', `Must be the number ${MANIFEST_VERSION}. Got ${JSON.stringify(raw.manifestVersion)}.`);
  }

  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) {
    fail(errors, 'id', 'Must be 3–32 characters, lowercase letters, digits and hyphens, starting with a letter.');
  }

  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    fail(errors, 'name', 'Required. The name the wearer sees.');
  } else if (raw.name.length > 24) {
    /* 600px wide, one eye, read at arm's length. A long name is not a style
       preference here, it is a truncation bug waiting to ship. */
    fail(errors, 'name', `Must be 24 characters or fewer to fit the display. Got ${raw.name.length}.`);
  }

  if (typeof raw.version !== 'string' || !SEMVER_RE.test(raw.version)) {
    fail(errors, 'version', 'Must be a semantic version such as "1.0.0".');
  }

  if (typeof raw.entry !== 'string' || !raw.entry.trim()) {
    fail(errors, 'entry', 'Required. Path to the app HTML, relative to the app folder.');
  } else if (/^([a-z]+:)?\/\//i.test(raw.entry) || raw.entry.startsWith('/')) {
    fail(errors, 'entry', 'Must be a relative path inside the app folder. Remote entry points are not installable.');
  }

  if (raw.category !== undefined && !CATEGORIES.includes(raw.category)) {
    fail(errors, 'category', `Must be one of: ${CATEGORIES.join(', ')}.`);
  }

  /* Permissions. Unknown names are a hard error — silently ignoring one means
     the app believes it has a capability the OS will never grant. */
  const perms = raw.permissions ?? [];
  if (!Array.isArray(perms)) {
    fail(errors, 'permissions', 'Must be an array of permission names.');
  } else {
    for (const p of perms) {
      if (typeof p !== 'string' || !PERMISSIONS[p]) {
        fail(errors, 'permissions', `Unknown permission ${JSON.stringify(p)}. Known: ${Object.keys(PERMISSIONS).join(', ')}.`);
      }
    }
    const seen = new Set();
    for (const p of perms) {
      if (seen.has(p)) fail(errors, 'permissions', `Duplicate permission "${p}".`);
      seen.add(p);
    }
  }

  /* Reasons. The OS refuses to ask the wearer for a high-risk capability
     without the app saying, in its own words, what it needs it for. */
  const reasons = raw.permissionReasons ?? {};
  if (typeof reasons !== 'object' || reasons === null || Array.isArray(reasons)) {
    fail(errors, 'permissionReasons', 'Must be an object mapping permission name to a short reason string.');
  } else {
    for (const p of Array.isArray(perms) ? perms : []) {
      const meta = PERMISSIONS[p];
      if (!meta) continue;
      const r = reasons[p];
      if (meta.risk === 'high' && (typeof r !== 'string' || r.trim().length < 8)) {
        fail(errors, `permissionReasons.${p}`, `"${meta.label}" is high risk and requires a reason of at least 8 characters explaining why the app needs it.`);
      } else if (typeof r === 'string' && r.length > 90) {
        fail(errors, `permissionReasons.${p}`, `Reason must be 90 characters or fewer. Got ${r.length}.`);
      } else if (r === undefined && meta.risk !== 'high') {
        warnings.push({ field: `permissionReasons.${p}`, message: `No reason given for "${meta.label}". The wearer sees only the system explanation.` });
      }
    }
    for (const k of Object.keys(reasons)) {
      if (Array.isArray(perms) && !perms.includes(k)) {
        warnings.push({ field: `permissionReasons.${k}`, message: `Reason given for "${k}", which the app does not request.` });
      }
    }
  }

  if (raw.badge !== undefined && typeof raw.badge !== 'string') {
    fail(errors, 'badge', 'Must be a string: the placeholder line shown before the app first runs.');
  }
  if (typeof raw.badge === 'string' && raw.badge.length > 28) {
    fail(errors, 'badge', `Must be 28 characters or fewer to fit the home surface. Got ${raw.badge.length}.`);
  }

  if (raw.offline !== undefined && typeof raw.offline !== 'boolean') {
    fail(errors, 'offline', 'Must be a boolean: whether the app is usable with no network.');
  }
  if (raw.offline !== true && Array.isArray(perms) && !perms.includes('network')) {
    warnings.push({ field: 'offline', message: 'App does not request network and does not declare offline support. Declare "offline": true if it works without a connection.' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest: errors.length === 0 ? normalize(raw) : null,
  };
}

function normalize(raw) {
  return {
    manifestVersion: raw.manifestVersion,
    id: raw.id,
    name: raw.name.trim(),
    version: raw.version,
    entry: raw.entry,
    category: raw.category ?? 'utility',
    developer: raw.developer ?? 'Unknown developer',
    permissions: [...(raw.permissions ?? [])],
    permissionReasons: { ...(raw.permissionReasons ?? {}) },
    badge: raw.badge ?? '',
    offline: raw.offline === true,
    accent: raw.accent ?? null,
    glyph: raw.glyph ?? raw.name.trim().slice(0, 1).toUpperCase(),
  };
}

export default validateManifest;
