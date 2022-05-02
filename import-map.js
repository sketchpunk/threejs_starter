// in the future can prob do : <script type="importmap" src="/import-map.json"></script>
document.body.appendChild(Object.assign(document.createElement('script'), {
type		: 'importmap',
innerHTML	: `
    {"imports":{
        "three"             : "/node_modules/three/build/three.module.js",
        "OrbitControls"	    : "/node_modules/three/examples/jsm/controls/OrbitControls.js",
        "webxr/"            : "/node_modules/three/examples/jsm/webxr/",
        "threejsm/"         : "/node_modules/three/examples/jsm/",
        "gl-matrix"         : "/node_modules/gl-matrix/esm/index.js"
    }}
`}));