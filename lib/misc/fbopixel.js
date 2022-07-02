import * as THREE from "./three.module.js";

class FboPixel{
    constructor( renderer, tex ){
        this.renderer = renderer;
        this.target   = null;
        this.shader   = null;

        this._buildFbo();
        this._buildShader( tex );
    }

    _buildFbo(){
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Get The Size of the Canvas
        let size = new THREE.Vector2();
        this.renderer.getSize( size );

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Build a custom FrameBuffer that will capture information
        // about the model being drawn onto.
        const rt    = new THREE.WebGLMultipleRenderTargets( size.x, size.y, 4 );
        rt.format   = THREE.RGBAFormat;
        rt.type     = THREE.FloatType; 

        //-------------------------------
        // Color Buffer : Will see Paint texture results here.
        rt.texture[ 0 ].name            = 'color';
        rt.texture[ 0 ].minFilter       = THREE.NearestFilter;
        rt.texture[ 0 ].magFilter       = THREE.NearestFilter;
        rt.texture[ 0 ].type            = THREE.FloatType;

        //-------------------------------
        // Normal Buffer : Know the direction the pixel is pointing
        // TODO - ThreeJS can not handle RGB16F, using RGBA version instead.
        rt.texture[ 1 ].name            = 'normal';
        rt.texture[ 1 ].minFilter       = THREE.NearestFilter;
        rt.texture[ 1 ].magFilter       = THREE.NearestFilter;
        rt.texture[ 1 ].type            = THREE.FloatType;
        rt.texture[ 1 ].format          = THREE.RGBAFormat;
        rt.texture[ 1 ].internalFormat  = "RGBA16F";  

        //-------------------------------
        // UV Buffer : Know the UV Coordinate of the Pixel
        rt.texture[ 2 ].name            = 'uv';
        rt.texture[ 2 ].minFilter       = THREE.NearestFilter;
        rt.texture[ 2 ].magFilter       = THREE.NearestFilter;
        rt.texture[ 2 ].type            = THREE.FloatType;
        rt.texture[ 2 ].format          = THREE.RGFormat;
        rt.texture[ 2 ].internalFormat  = "RG16F";    
    
        //-------------------------------
        // Position Buffer : Know the Position of the pixel in world space
        // NOTE: Read that the depth buffer can not be read to the cpu which is
        // ashame because we can compute worldspace position with it. Since its not
        // possible, capture the WS Position in another texture. Use the ALPHA value
        // to denote that the user clicked on a valid pixel.
        rt.texture[ 3 ].name            = 'pos';
        rt.texture[ 3 ].minFilter       = THREE.NearestFilter;
        rt.texture[ 3 ].magFilter       = THREE.NearestFilter;
        rt.texture[ 3 ].type            = THREE.FloatType;
        rt.texture[ 3 ].format          = THREE.RGBAFormat;
        rt.texture[ 3 ].internalFormat  = "RGBA32F";  

        //-------------------------------
        // Depth Buffer
        rt.depthBuffer                  = true;
        rt.depthTexture                 = new THREE.DepthTexture();
        rt.depthTexture.format          = THREE.DepthFormat;
        rt.depthTexture.type            = THREE.UnsignedShortType;

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.target = rt;
    }

    _buildShader( tex ){
        this.shader = new THREE.RawShaderMaterial({
            uniforms        : { txColor : { value: tex } },
            vertexShader    : VERTSRC,
            fragmentShader  : FRAGSRC,
        });
    }
    
    getData( x, y ){
        const px        = new Float32Array( 4 );
        const gl        = this.renderer.getContext();
        const fbo       = this.renderer.properties.get( this.target ).__webglFramebuffer;
        let rtn         = null;
    
        gl.bindFramebuffer( gl.READ_FRAMEBUFFER, fbo );
        
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Grab Position First.
        gl.readBuffer( gl.COLOR_ATTACHMENT3 );
        gl.readPixels( x, y, 1, 1, gl.RGBA, gl.FLOAT, px );

        if( px[ 3 ] != 0 ){
            rtn = { pos:null, uv:null, norm:null };
            rtn.pos = px.slice( 0, 3 );

            //-----------------------------------
            // Get UV
            gl.readBuffer( gl.COLOR_ATTACHMENT2 );
            gl.readPixels( x, y, 1, 1, gl.RGBA, gl.FLOAT, px );
            rtn.uv = px.slice( 0, 2 );

            //-----------------------------------
            // Get Normal
            gl.readBuffer( gl.COLOR_ATTACHMENT1 );
            gl.readPixels( x, y, 1, 1, gl.RGBA, gl.FLOAT, px );
            rtn.norm = px.slice( 0, 3 );
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Cleanup
        gl.bindFramebuffer( gl.READ_FRAMEBUFFER, null );
        
        return rtn;
    }
}

const VERTSRC = `#version 300 es
in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 fragPNorm;
out vec3 fragNorm;
out vec2 fragUV;
out vec3 fragWPos;

uniform mat3 normalMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

void main() {
    vec4 wpos   = modelMatrix * vec4( position, 1.0 );
    
    fragUV      = uv;
    fragWPos    = wpos.xyz;
    fragNorm    = normalize( normalMatrix * normal );
    fragPNorm   = normal;   // True Point Normal, without Transformation.

    gl_Position = projectionMatrix * viewMatrix * wpos;
}
`;

const FRAGSRC = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D txColor;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNorm;
layout(location = 2) out vec2 outUV;
layout(location = 3) out vec4 outPos;

in vec3 fragPNorm;
in vec3 fragNorm;
in vec2 fragUV;
in vec3 fragWPos;

const vec3 lightDir = normalize( vec3( 2.0, 3.0, 6.0 ) );

void main() {
    
    outNorm     = vec4( normalize( fragPNorm ), 0.0 );
    outUV       = fragUV;
    outPos      = vec4( fragWPos, 1.0 );

    vec3 px     = texture( txColor, fragUV ).rgb;
    outColor    = vec4( px, 1.0 );

    vec3 norm   = normalize( fragNorm );
    outColor.rgb *= clamp( dot( norm, lightDir ), 0.2, 1.0 ); // A little Diffuse Shading to give it 3D look
}
`;

export default FboPixel;