


// #region HELPER FUNCTIONS

/** Wrap a mesh's geometry with additional instance buffers, Position, Euler Rotation, Scale and Color */
function buildInstancedGeometry(
  geo: TThreeGeo,
  instPos: Float32Array,
  instRot: Float32Array,
  instScl: Float32Array,
  instCol: Float32Array,
): InstancedBufferGeometry {
  const bGeo = new THREE.InstancedBufferGeometry();
  bGeo.needsUpdate = true;

  // Standard Mesh Attributes
  bGeo.setAttribute('position', new THREE.BufferAttribute(geo.vertices, 3));

  if (geo.indices) {
    bGeo.setIndex(geo.indices);
  }

  if (geo.normals) {
    bGeo.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3));
  }

  if (geo.uv) {
    bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(geo.uv, 2));
  }

  // Custom Instanced Attributes
  const bPos = new THREE.InstancedBufferAttribute(instPos, 3);
  bGeo.setAttribute('instPos', bPos);
  bPos.setUsage(THREE.DynamicDrawUsage);

  const bRot = new THREE.InstancedBufferAttribute(instRot, 3);
  bGeo.setAttribute('instRot', bRot);
  bRot.setUsage(THREE.DynamicDrawUsage);

  const bScl = new THREE.InstancedBufferAttribute(instScl, 3);
  bGeo.setAttribute('instScl', bScl);
  bRot.setUsage(THREE.DynamicDrawUsage);

  const bCol = new THREE.InstancedBufferAttribute(instCol, 3);
  bGeo.setAttribute('instCol', bCol);
  bCol.setUsage(THREE.DynamicDrawUsage);

  // Finalize
  bGeo.computeBoundingSphere();
  bGeo.computeBoundingBox();
  return bGeo;
}

/** Convert string color to GLSL code & store it in the color buffer at indexed position */
function fromHexColor(c: string, idx: number, buf: Float32Array) {
  const toNormRgb = 1 / 255.0;
  buf[idx] = parseInt(c[1] + c[2], 16) * toNormRgb;
  buf[idx + 1] = parseInt(c[3] + c[4], 16) * toNormRgb;
  buf[idx + 2] = parseInt(c[5] + c[6], 16) * toNormRgb;
}
// #endregion

export class InstancedPosRotSclCol {
  // #region MAIN

  // eslint-disable-next-line fb-www/no-uninitialized-properties
  instPos: Float32Array; // Instance buffer for position
  // eslint-disable-next-line fb-www/no-uninitialized-properties
  instRot: Float32Array; // Instance buffer for euler rotation
  // eslint-disable-next-line fb-www/no-uninitialized-properties
  instScl: Float32Array; // Instance buffer for scale
  // eslint-disable-next-line fb-www/no-uninitialized-properties
  instCol: Float32Array; // Instance buffer for color

  baseGeo: TThreeGeo; // Keep base geometry when resizing buffers are done
  mesh: TStandardMesh; // Instanced mesh that can be added to the scene
  _capacity: number = -1; // How many instances does the geometry object currently can handle

  constructor(geo: TThreeGeo, initCap: number = 2, objScale: number = 1) {
    this.baseGeo = geo;
    this.mesh = new THREE.Mesh();
    this.mesh.material = customInstancedMaterial(objScale);

    this.resize(initCap);

    this.mesh.geometry.instanceCount = 0;
  }
  // #endregion

  // #region METHODS
  /** Resize geometry buffers if larger then current capacity */
  resize(size: number): void {
    if (size <= this._capacity) {
      return;
    }
    this._capacity = size;

    // Resize local buffers
    const fPos = new Float32Array(size * 3);
    if (this.instPos) {
      fPos.set(this.instPos);
    }
    this.instPos = fPos;

    const fRot = new Float32Array(size * 3);
    if (this.instRot) {
      fRot.set(this.instRot);
    }
    this.instRot = fRot;

    const fScl = new Float32Array(size * 3);
    if (this.instScl) {
      fRot.set(this.instScl);
    }
    this.instScl = fScl;

    const fCol = new Float32Array(size * 3);
    if (this.instCol) {
      fCol.set(this.instCol);
    }
    this.instCol = fCol;

    // Do house keeping on existing geometry buffers
    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    this.mesh.geometry = buildInstancedGeometry(
      this.baseGeo,
      this.instPos,
      this.instRot,
      this.instScl,
      this.instCol,
    );
  }

  /** Set instance data at a specific index */
  setItem(
    idx: number,
    pos: Array<number> | [number, number, number],
    rot: Array<number> | [number, number, number],
    scl: Array<number> | [number, number, number],
    col: Array<number> | string,
  ): void {
    if (idx >= this._capacity) {
      return;
    }

    const i = idx * 3;

    this.instPos[i] = pos[0];
    this.instPos[i + 1] = pos[1];
    this.instPos[i + 2] = pos[2];

    this.instRot[i] = rot[0];
    this.instRot[i + 1] = rot[1];
    this.instRot[i + 2] = rot[2];

    this.instScl[i] = scl[0];
    this.instScl[i + 1] = scl[1];
    this.instScl[i + 2] = scl[2];

    if (typeof col === 'string') {
      fromHexColor(col, i, this.instCol);
    } else {
      this.instCol[i] = col[0];
      this.instCol[i + 1] = col[1];
      this.instCol[i + 2] = col[2];
    }
  }

  /** Set instance count which controls how many gets rendered. Can render less then capacity */
  setInstanceCount(v: number) {
    this.mesh.geometry.instanceCount = v;
  }

  /** After modifing instance information, need to call update so threejs knows that it needs to upload to gpu */
  updateGeometry(cnt: number) {
    const geo = this.mesh.geometry;

    const bPos: Any3JS = geo.attributes.instPos;
    const bRot: Any3JS = geo.attributes.instRot;
    const bScl: Any3JS = geo.attributes.instScl;
    const bCol: Any3JS = geo.attributes.instCol;

    bPos.array.set(this.instPos);
    bPos.needsUpdate = true;

    bRot.array.set(this.instRot);
    bRot.needsUpdate = true;

    bScl.array.set(this.instScl);
    bScl.needsUpdate = true;

    bCol.array.set(this.instCol);
    bCol.needsUpdate = true;

    geo.instanceCount = cnt;
    geo.computeBoundingBox(); // Needed for Ray casting into mesh
    geo.computeBoundingSphere();
  }
  // #endregion
}

/** Custom shader that utilizes instanced data to render the base mesh */
function customInstancedMaterial(scale: number = 1.0): Material {
  const mat: Material = new THREE.RawShaderMaterial({
    uniforms: {
      scale: {type: 'float', value: scale},
    },

    vertexShader: `#version 300 es
    in vec3 position;
    in vec3 normal;
    in vec3 instPos;
    in vec3 instRot;
    in vec3 instScl;
    in vec3 instCol;

    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    uniform float scale;

    out vec3 fragNorm;
    out vec3 fragColor;

    const float DEG2RAD = 0.01745329251; // PI / 180

    // YXZ rotation, but apply it backwards
    void eulerRotation( vec3 rot, inout vec3 pos, inout vec3 norm ){
      float s;
      float c;
      vec3  v;

      if( rot.z != 0.0 ){
        c     = cos( rot.z );
        s     = sin( rot.z );
        v     = pos;
        pos.x = v.x * c - v.y * s;
        pos.y = v.x * s + v.y * c;

        v      = norm;
        norm.x = v.x * c - v.y * s;
        norm.y = v.x * s + v.y * c;
      }

      if( rot.x != 0.0 ){
        c     = cos( rot.x );
        s     = sin( rot.x );
        v     = pos;
        pos.y = v.y * c - v.z * s;
        pos.z = v.y * s + v.z * c;

        v      = norm;
        norm.y = v.y * c - v.z * s;
        norm.z = v.y * s + v.z * c;
      }

      if( rot.y != 0.0 ){
        c    = cos( rot.y );
        s    = sin( rot.y );
        v    = pos;
        pos.x = v.z * s + v.x * c;
        pos.z = v.z * c - v.x * s;

        v    = norm;
        norm.x = v.z * s + v.x * c;
        norm.z = v.z * c - v.x * s;
      }
    }

    void main(){
      // Apply euler rotation
      vec3 pos    = position * instScl * scale;
      vec3 norm   = normal;
      eulerRotation( instRot * DEG2RAD, pos, norm );

      // Apply Matrices
      vec4 wPos	  = modelMatrix * vec4( pos + instPos, 1.0 );
      gl_Position	= projectionMatrix * viewMatrix * wPos;

      // Fragment outputs
      fragNorm    = ( modelMatrix * vec4( norm, 0.0 ) ).xyz;
      fragColor   = instCol;
    }`,

    fragmentShader: `#version 300 es
    precision mediump float;

    in vec3 fragNorm;
    in vec3 fragColor;

    out vec4 outColor;

    // Hard code light directions
    vec3 sunDir = normalize( vec3( 10.0, 10.0, 10.0 ) );
    vec3 grdDir = vec3( 0.0, -1.0, 0.0 );

    void main(){
      vec3 norm     = normalize( fragNorm );
      float diffuse = clamp(
        clamp( dot( norm, sunDir ), 0.0, 1.0 ) +  // Sun downward light
        clamp( dot( norm, grdDir ), 0.0, 0.24 ),  // Ground reflected light
        0.2,
        1.0
      );
      outColor = vec4( fragColor * diffuse, 1.0 );
    }`,
  });

  return mat;
}
