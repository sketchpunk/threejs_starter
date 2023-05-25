import * as THREE  from 'three';


export default function gridCube(){
    const geo  = new THREE.BoxGeometry( 2, 2, 2 ); 
    const mesh = new THREE.Mesh( geo, customMaterial() ); // new THREE.MeshPhongMaterial()
    // mesh.scale.setScalar( 3 );
    return mesh;
}


function customMaterial( color=0x606060, cellSize=1.0, lineSize=0.005, radius=0.15 ){
    const mat = new THREE.RawShaderMaterial({
        name            : 'Grid',
        side            : THREE.BackSide, //THREE.DoubleSide
        depthTest       : true,
        transparent 	: true,
        // alphaToCoverage : true,
        extensions      : { derivatives : true },

        uniforms        : {
            lineColor : { type: 'vec3',  value: new THREE.Color( color ) },
            lineSize  : { type: 'float', value: lineSize },
            cellSize  : { type: 'float', value: cellSize },
            radius    : { type: 'float', value: radius },
        },

        vertexShader    : `#version 300 es
        in	vec3    position;
        in  vec3    normal;
        in	vec2    uv;
        
        // uniform highp vec3 cameraPosition;

        uniform mat4  modelMatrix;
        uniform mat4  viewMatrix;
        uniform mat4  projectionMatrix;

        flat out vec3 fragMaxLPos;
        flat out vec3 fragLNorm;
             out vec3 fragScaleLPos;
        
        // ############################################################
             
        vec3 decomposeScaleFromMat4( mat4 m ){
            return vec3(
                length( vec3( m[0][0], m[0][1], m[0][2] ) ),
                length( vec3( m[1][0], m[1][1], m[1][2] ) ),
                length( vec3( m[2][0], m[2][1], m[2][2] ) )
            );
        }

        // ############################################################

        void main(){
            vec4 wPos     = modelMatrix * vec4( position, 1.0 );  // World Space
            vec4 vPos     = viewMatrix  * wPos;                   // View Space
            gl_Position   = projectionMatrix * vPos;

            // Scaled Localspace Position
            fragScaleLPos = position * decomposeScaleFromMat4( modelMatrix );

            // Non-Interpolated values
            fragMaxLPos   = abs( fragScaleLPos );
            fragLNorm     = abs( normal );
        }`,

        fragmentShader  : `#version 300 es
        precision mediump float;

        uniform vec3  lineColor;
        uniform float lineSize;
        uniform float cellSize;
        uniform float radius;

        flat in vec3 fragMaxLPos;
        flat in vec3 fragLNorm;
             in vec3 fragScaleLPos;

        out vec4 outColor;

        // #####################################################################

        void main(){      
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // FACE GRID
            vec3 pos   = fragScaleLPos / cellSize;  // Divide LS Pos into cells
            pos       -= 0.5;                       // Shift grid half unit to left
            pos        = fract( pos );              // Get fraction to reduce value between -1 and 1
            pos       -= 0.5;                       // Remap 0 > 1 to -0.5 > 0 > 0.5
            pos        = abs( pos );                // Remap to 0.5 > 0 > 0.5
            
            // Anti-Alias the lines
            vec3 fw    = fwidth( fragScaleLPos );
            vec3 grid  = smoothstep( vec3( lineSize ), lineSize + fw, pos );

            // Add normal to make the face axis to filter out to have the largest value
            // which will result in the face axis remain.
            // For example Z face is XY & has a normal of [0,0,1], adding 1 in Z will
            // filter out Z when doing MIN op on all 3 axes leaving behind only XY.
            grid      += fragLNorm; 
            float mask = 1.0 - min( min( grid.x, grid.y ), grid.z );

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // CENTER POINT
            float dist  = length( fragScaleLPos * ( 1.0 - fragLNorm ) );
            float cFW   = fwidth( dist );
            float cMask = 1.0 - smoothstep( radius, radius + cFW, dist );

            mask = max( mask, cMask );

            // RENDER
            outColor = vec4( lineColor * mask, mask );
        }`
    });

    
    Object.defineProperty( mat, 'cellSize', {
        set( v ){ mat.uniforms.cellSize.value = v; }
    });

    return mat;
}