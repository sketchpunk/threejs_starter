import * as THREE  from 'three';

export default function CursorMesh( props ){
  props = Object.assign( { size:2, w:0, h:0, y:0 }, props );

  const geo  = new THREE.PlaneGeometry( props.w || props.size, props.h || props.size );
  geo.rotateX( -Math.PI * 0.5 );

  return new THREE.Mesh( geo, cursorMaterial() );
}

// #region SHADER

function cursorMaterial(){
  return new THREE.RawShaderMaterial({
    side            : THREE.DoubleSide,
    transparent     : true,
    forceSinglePass : true, 
    uniforms        : {},

    vertexShader  : `#version 300 es
    in  vec3  position;
    in  vec3  normal;
    in  vec2  uv;

    uniform mat4  modelViewMatrix;
    uniform mat4  projectionMatrix;

    out vec2 fragUV;
    out vec3 fragLPos;
    out vec3 fragWPos;

    void main(){
        vec4 wPos     = modelViewMatrix * vec4( position, 1.0 );

        fragUV        = uv;
        fragWPos      = wPos.xyz;
        fragLPos      = position;

        gl_Position   = projectionMatrix * wPos;
    }`,

    fragmentShader  : `#version 300 es
    precision mediump float;

    in  vec2 fragUV;
    in  vec3 fragLPos;
    in  vec3 fragWPos;

    out vec4 outColor;

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    float coord_len   = 0.0;  // Localspace Coord Length
    float coord_dxdy  = 0.0;

    float circle( float radius ){
        return smoothstep( radius + coord_dxdy, radius - coord_dxdy, coord_len );
    }

    float ring( float outer, float inner ){
        return  smoothstep( inner - coord_dxdy, inner + coord_dxdy, coord_len ) -
                smoothstep( outer - coord_dxdy, outer + coord_dxdy, coord_len );
    }

    float sdTriangleIsosceles( in vec2 p, in vec2 q ){
        p.x = abs(p.x);
        vec2  a = p - q*clamp( dot(p,q)/dot(q,q), 0.0, 1.0 );
        vec2  b = p - q*vec2( clamp( p.x/q.x, 0.0, 1.0 ), 1.0 );
        float s = -sign( q.y );
        vec2  d = min( vec2( dot(a,a), s*(p.x*q.y-p.y*q.x) ),
                       vec2( dot(b,b), s*(p.y-q.y)  ));
        return -sqrt(d.x)*sign(d.y);
    }

    float triangle( float xSize, float ySize, float xOffset, float yOffset ){
      vec2 coord = vec2( fragLPos.x, -fragLPos.z ); // render SDF object with a 180 degree rotation
      coord.x += xOffset;
      coord.y += yOffset;

      float d = sdTriangleIsosceles( coord, vec2( xSize, ySize ) );
      return 1.0 - smoothstep( 0.0-coord_dxdy, 0.0+coord_dxdy, d ); // Smooth & Invert Mask
    }

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    void main(){
      coord_len   = dot( fragLPos.xz, fragLPos.xz );          // Coord Local Space Length
      coord_dxdy  = fwidth( coord_len );                      // Pixel Width in relation to coord_len

      float alpha = circle( 0.03 );                           // Inner Dot
      alpha = max( alpha, ring( 0.95, 0.8 ) );                // Outer Ring
      alpha = max( alpha, ring( 0.5, 0.46 ) );                // Inner Ring

      // Forward Triange with its bottom clipped using circle mask
      float innerRingMask = 1.0 - step( coord_len, 0.48 );
      alpha = max( alpha, triangle( 0.2, 0.2, 0.0, 0.85 ) * innerRingMask );

      float c = ( gl_FrontFacing )? 1.0 : 0.5;
      outColor = vec4( c, c, c, alpha );
    }`,
  });
}

// #endregion
