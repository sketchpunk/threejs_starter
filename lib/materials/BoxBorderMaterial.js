import * as THREE from "three";

/** Material to draw a border around each face of a cube */
export default function BoxBorderMaterial( props={} ){
    props = Object.assign( {
        borderSize  : 0.01,
        faceColor   : 0xe0e0e0,
        faceAlpha   : 0.2,
        borderColor : null,
        borderAlpha : 1.0,
    }, props );


    const mat = new THREE.RawShaderMaterial({
        depthTest       : true,
        transparent     : true,
        alphaToCoverage : false,
        side            : THREE.DoubleSide,

        uniforms: {
            borderSize    : { type: 'float', value: props.borderSize },
            borderColor   : {
                type  : 'vec3',
                value : new THREE.Color( props.borderColor !== null ? props.borderColor : props.faceColor ),
            },

            borderAlpha   : { type: 'float', value: props.borderAlpha },
            faceColor     : { type: 'vec3',  value: new THREE.Color( props.faceColor ) },
            faceAlpha     : { type: 'float', value: props.faceAlpha },
        },

        extensions: { derivatives: true, },

        vertexShader: `#version 300 es
        in vec3 position;
        in vec3 normal;
        in vec2 uv;

        uniform mat4 modelMatrix;
        uniform mat4 viewMatrix;
        uniform mat4 projectionMatrix;

        flat out vec3 fragMaxLPos;
        flat out vec3 fragLNorm;
            out vec3 fragScaleLPos;

        vec3 decomposeScaleFromMat4( mat4 m ){
        return vec3(
            length( vec3( m[0][0], m[0][1], m[0][2] ) ),
            length( vec3( m[1][0], m[1][1], m[1][2] ) ),
            length( vec3( m[2][0], m[2][1], m[2][2] ) )
        );
        }

        void main(){
            vec4 wPos     = modelMatrix * vec4( position, 1.0 );  // World Space
            vec4 vPos     = viewMatrix * wPos;                    // View Space
            gl_Position   = projectionMatrix * vPos;

            // Scaled Localspace Position
            fragScaleLPos = position * decomposeScaleFromMat4( modelMatrix );

            // Non-Interpolated values
            fragMaxLPos   = abs( fragScaleLPos );
            fragLNorm     = abs( normal );
        }`,

        fragmentShader: `#version 300 es
        precision mediump float;

        uniform float borderSize;
        uniform vec3  borderColor;
        uniform float borderAlpha;
        uniform vec3  faceColor;
        uniform float faceAlpha;

        flat in vec3 fragMaxLPos;
        flat in vec3 fragLNorm;
            in vec3 fragScaleLPos;

        out vec4 outColor;

        void main(){
        vec3 absPos = abs( fragScaleLPos );  // Absolute Scaled Position to handle negative axes
        vec3 px     = fwidth( absPos );      // Pixel Difference

        // Use normal to filter out specific axis, ex: Front face, its normal is [0,0,1]
        // We only need XY to draw border, so adding normal makes sure Z get a higher value by
        // adding 1 to its results value while adding 0 to the others. Using the MIN function will
        // end up selecting either X or Y since it'll have the smallest value & filter out Z.

        vec3 vMask = fragLNorm + smoothstep( fragMaxLPos - borderSize, fragMaxLPos - borderSize - px, absPos );
        float mask = 1.0 - min( min( vMask.x, vMask.y ), vMask.z );

        outColor   = mix( vec4( faceColor, faceAlpha ), vec4( borderColor, borderAlpha ), mask );
        }`,
    });

    Object.defineProperty(mat, 'faceColor', {
        set( c ){ mat.uniforms.faceColor.value.set( c ); },
    });

    Object.defineProperty(mat, 'borderSize', {
        set( v ){ mat.uniforms.borderSize.value = v; },
    });

    return mat;
}
