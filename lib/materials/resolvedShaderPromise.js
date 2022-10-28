import { ShaderChunk } from 'three';

export default function resolvedShaderPromise( mat ){
    return new Promise( (resolve, reject )=>{
        mat.onBeforeCompile = function( shader, renderer ){
            const out = { 
                vertex   : resolveIncludes( shader.vertexShader ), 
                fragment : resolveIncludes( shader.fragmentShader ),
            };

            resolve( out );
        };
    });
}

// https://github.com/mrdoob/three.js/blob/d9af9952fc32c2a1281707946177135b90297aab/src/renderers/webgl/WebGLProgram.js#L205
function resolveIncludes( src ){
    const includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm;
    return src.replace( includePattern, includeReplacer );
}

function includeReplacer( match, include ) {
	const string = ShaderChunk[ include ];
	if( string === undefined ) throw new Error( 'Can not resolve #include <' + include + '>' );
	return resolveIncludes( string );
}
