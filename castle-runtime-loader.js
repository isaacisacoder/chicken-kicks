// Resolve relative to this script for root and project-site deployments.
window.castleRuntimeFactory = import(new URL('castle-runtime.mjs?v=60633624a687', document.currentScript.src).href).then(module => module.default);
