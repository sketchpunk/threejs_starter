import { RawShaderMaterial, PlaneBufferGeometry, Mesh, Color, DoubleSide } from 'three';

function rgba( c, a=1.0 ){
    const NORMALIZE_RGB	= 1 / 255.0;
    return [
        ( c >> 16 & 255 ) * NORMALIZE_RGB,
        ( c >> 8 & 255 )  * NORMALIZE_RGB,
        ( c & 255 )       * NORMALIZE_RGB,
        a
    ];
}

export default function InfiniteGridMaterial(){
    const mat = new RawShaderMaterial({
        name            : 'InfiniteGrid',
        side            : DoubleSide,
        depthTest       : true,
        transparent 	: true,
        alphaToCoverage : true,
        extensions      : { derivatives : true },

        uniforms        : {
            minGrid    : { type: 'float', value: 0.2 },
            maxGrid    : { type: 'float', value: 1 },
            maxThick   : { type: 'float', value: 0.01 },
            planeScale : { type: 'float', value: 200 },
            baseColor  : { type: 'vec4',  value: rgba( 0x3f3f3f, 0 ) },
            minColor   : { type: 'vec4',  value: rgba( 0x4c4c4c, 1 ) },
            maxColor   : { type: 'vec4',  value: rgba( 0x505050, 1 ) },
        },

        vertexShader    : `#version 300 es
        in	vec3    position;
        in  vec3    normal;
        in	vec2    uv;
        
        uniform highp vec3 cameraPosition;
        uniform mediump float planeScale;

        uniform mat4  modelMatrix;
        uniform mat4  viewMatrix;
        uniform mat4  projectionMatrix;

        out vec3  fragPos;
        
        // ############################################################

        void main(){
            vec3 pos        = position.xzy * planeScale;  // Scale the grid
            pos.xz         += cameraPosition.xz;          // Move it so its always in from of the camera
            fragPos         = pos;

            vec4 wPos       = modelMatrix * vec4( pos, 1.0 );
            gl_Position     = projectionMatrix * viewMatrix * wPos;
        }`,

        fragmentShader  : `#version 300 es
        precision mediump float;
                
        uniform highp vec3 cameraPosition;
        uniform mediump float planeScale;

        uniform float minGrid;
        uniform float maxGrid;
        uniform float maxThick;
        uniform vec4  baseColor;
        uniform vec4  minColor;
        uniform vec4  maxColor;
    
        in vec3 fragPos;
        
        out vec4 outColor;

        // #####################################################################

        const vec2 mid = vec2( 0.5 );

        float getThinGrid( vec2 pos, float size ) {
            vec2 coord  = pos / size;
            vec2 grid   = abs( fract( coord - mid ) - mid ) / fwidth( coord );
            float line  = min( grid.x, grid.y );
            return 1.0 - min( line, 1.0 );
        }

        float getThickGrid( vec2 pos, float size, float thick ){
            vec2 coord  = pos / size - 0.5;     // Divide position Size, then move to center
            vec2 grad   = fract( coord );		// Normalize-ish, get 0 -> 1
            vec2 pxGrad = fwidth( coord );	    // Pixel Width of POS
                        
            vec2 th     = vec2( thick );
            vec2 grid   = 
                    smoothstep( mid - th - pxGrad, mid - th, grad ) -       // Furthest Left of Mid
                    smoothstep( mid + th, mid + th + pxGrad, grad );        // Furthest Right of Mid

            return max( grid.x, grid.y );
        }

        // #####################################################################
        void main(){                          
            float g1   = getThinGrid( fragPos.xz, minGrid );
            float g2   = getThickGrid( fragPos.xz, maxGrid, maxThick );

            outColor   = mix( baseColor, minColor, g1 );
            outColor   = mix( outColor,  maxColor, g2 );

            //float d    = 1.0 - min( distance( cameraPosition.xzy, fragPos.xzy ) / planeScale, 1.0 );
            float d    = 1.0 - min( distance( cameraPosition.xz, fragPos.xz ) / planeScale, 1.0 );
            outColor.a = max( g1, g2 ) * pow( d, 3.0 );
        }`
    });


    const props = {
        minGrid     : 0.2,
        maxGrid     : 1,
        maxThick    : 0.01,
        planeScale  : 100,
        baseColorA  : 0.0,
        baseColor   : 0x3f3f3f,
        minColor    : 0x4c4c4c,
        minColorA   : 1.0,
        maxColor    : 0x505050,
        maxColorA   : 1.0,
        update      : ()=>updateParameters( mat.uniforms, props ),
    }

    mat.props = props;
    return mat;
}


function updateParameters( uniforms, props ){
    uniforms.minGrid.value     = props.minGrid;
    uniforms.maxGrid.value     = props.maxGrid;
    uniforms.maxThick.value    = props.maxThick;
    uniforms.planeScale.value  = props.planeScale;

    uniforms.baseColor.value   = rgba( props.baseColor, props.baseColorA );
    uniforms.minColor.value    = rgba( props.minColor,  props.minColorA );
    uniforms.maxColor.value    = rgba( props.maxColor,  props.maxColorA );
}


InfiniteGridMaterial.getMesh = ()=>{
    const geo  = new PlaneBufferGeometry( 2, 2, 1, 1 );
    const mesh = new Mesh( geo, InfiniteGridMaterial() );
    mesh.frustumCulled = false;
    mesh.renderOrder   = -900;
    return mesh;
}
