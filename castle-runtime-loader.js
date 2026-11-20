// Resolve relative to this script for root and project-site deployments.
window.castleRuntimeFactory = import(new URL('castle-runtime.mjs?v=e1639231be27', document.currentScript.src).href).then(module => module.default);
