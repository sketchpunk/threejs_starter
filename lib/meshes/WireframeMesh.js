import * as THREE from 'three';

export default function WireframeMesh( geo, props=null ){
    props      = Object.assign( { color:0xffffff, opacity:0.6, transparent:true }, props );
    const mat  = new THREE.LineBasicMaterial( props );
    const wGeo = new THREE.WireframeGeometry( geo );
    const mesh = new THREE.LineSegments( wGeo, mat );
    return mesh;
}