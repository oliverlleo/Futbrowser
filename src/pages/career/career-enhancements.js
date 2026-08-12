// Compatibility shim. The old enhancement runtime used recursive MutationObservers
// and could overload the Career Hub. The safe runtime owns profile/decorations now.
import './career-profile-v2.js?v=20260811-6';
