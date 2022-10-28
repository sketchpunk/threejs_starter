import { BufferGeometry, BufferAttribute } from 'three';

export default function createGeometry( { vertices=null, indices=null, normal=null, uv=null, color=null, skinWeight=null, skinIndex=null, skinSize=4 } = props ){
    const geo = new BufferGeometry();
    
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Data must be a TypeArray
    if( !( vertices instanceof Float32Array ) )         vertices = new Float32Array( vertices );
    if( color  && !( color instanceof Float32Array ) )  color    = new Float32Array( color );
    if( normal && !( normal instanceof Float32Array ) ) normal   = new Float32Array( normal );
    if( uv     && !( color instanceof Float32Array ) )  uv       = new Float32Array( uv );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    geo.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );

    if( indices )    geo.setIndex( new BufferAttribute( indices, 1 ) );
    if( normal )     geo.setAttribute( 'normal', new BufferAttribute( norm, 3 ) );
    if( uv )         geo.setAttribute( 'uv', new BufferAttribute( uv, 2 ) );
    if( color )      geo.setAttribute( 'color', new BufferAttribute( color, 3 ) );
    if( skinWeight ) geo.setAttribute( 'skinWeight', new BufferAttribute( skinWeight, skinSize ) );
    if( skinIndex )  geo.setAttribute( 'skinIndex',  new BufferAttribute( skinIndex,  skinSize ) );

    return geo;
}