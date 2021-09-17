// in the future can prob do : <script src="/import-map.js"></script>
document.body.appendChild(Object.assign(document.createElement('script'), {
	type		: 'importmap',
	innerHTML	: `
		{"imports":{
			"three"			    : "/node_modules/three/build/three.module.js",
			"OrbitControls"	    : "/node_modules/three/examples/jsm/controls/OrbitControls.js"
		}}
	`
}));