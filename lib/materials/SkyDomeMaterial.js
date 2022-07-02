import * as THREE from "three";

// Demo with Parameter UI https://sketchpunk.bitbucket.io/src/fungi_v5_5/028_skydome.html
/*
createSkyDome(){
    const mat  = SkyDomeMaterial();
    const geo  = new THREE.SphereGeometry(1000, 32, 16);
    const mesh = new THREE.Mesh( geo, mat );
    this._scene.add( mesh );
}
*/

export default function SkyDomeMaterial(){
    const uniforms = {
        sun_pos: { type :'vec3', value:new Float32Array([0,0.3,-0.5]) },
        params1: { type :'vec4', value:new Float32Array([0,0,0,0]) },
        params2: { type :'vec4', value:new Float32Array([0,0,0,0]) },
        params3: { type :'vec4', value:new Float32Array([0,0,0,0]) },
        params4: { type :'vec4', value:new Float32Array([0,0,0,0]) },
        params5: { type :'vec4', value:new Float32Array([0,0,0,0]) },
        params6: { type :'vec4', value:new Float32Array([0,0,0,0]) },
    };

    const matConfig = {
        side            : THREE.BackSide,
        uniforms        : uniforms,
        vertexShader    : VERT_SRC,
        fragmentShader	: FRAG_SRC,
    }

    const props = {
        density              : 0.99,     // 0 > 20
        clarity              : 0.2,      // -1 > 1
        pollution            : 0.03,     // 0 > 3
        brightness           : 10.0,     // 0 > 30
        atmosphereThickness  : 100000,   // 10000 > 100000
        atmosphereScale      : 1.0,
        planetRadius         : 6.371e6,
        planetScale          : 1.0,

        diskLatitude         : 180,      // -180 > 180
        diskLongitude        : 30,       // -90 > 90
        diskRadius           : 0.1,      // 0 > 2   - Size of the Sun/Moon
        diskIntensity        : 0.01,     // 0 > 2   - How Solid is it, 0 makes it very blurry

        update               : ()=>updateParameters( props, uniforms ),
    }

    props.update();

    const mat       = new THREE.RawShaderMaterial( matConfig );
    mat.extensions  = { derivatives : true }; // If not using WebGL2.0 and Want to use dfdx or fwidth, Need to load extension
    mat.props       = props;
    return mat;
}


function updateParameters( props, uniforms ){
    // https://www.gamasutra.com/blogs/ConorDickinson/20130925/200990/Stunning_Procedural_Skies_in_WebGL__Part_2.php
    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    const sun_pos       = uniforms.sun_pos.value;
    const params1       = uniforms.params1.value;
    const params2       = uniforms.params2.value;
    const params3       = uniforms.params3.value;
    const params4       = uniforms.params4.value;
    const params5       = uniforms.params5.value;
    const params6       = uniforms.params6.value;

    const sky_lambda    = [ 680e-9, 550e-9, 450e-9 ];
    const sky_k         = [ 0.686, 0.678, 0.666 ];
    const clarity       = 1 + props.clarity;
    const two_pi        = 2 * Math.PI;

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    vec3_fromPolar( props.diskLatitude, props.diskLongitude, sun_pos );

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // compute betaR
    let factor = 1.86e-31 / ( clarity * Math.max( props.density, 0.001 ) );
    params2[0] = factor / sky_lambda[0]**4;
    params2[1] = factor / sky_lambda[1]**4;
    params2[2] = factor / sky_lambda[2]**4;

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // compute betaM
    factor     = 1.36e-19 * Math.max( props.pollution, 0.001 );
    params3[0] = factor * sky_k[0] * (two_pi / sky_lambda[0])**2;
    params3[1] = factor * sky_k[1] * (two_pi / sky_lambda[1])**2;
    params3[2] = factor * sky_k[2] * (two_pi / sky_lambda[2])**2;

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // betaR + betaM, -(betaR + betaM), betaR / (betaR + betaM), betaM / (betaR + betaM)
    vec3_add( params2, params3, params1 ); // c.params1.from_add( c.params2, c.params3 );
    vec3_scale( vec3_add( params2, params3, params6 ), -1 ); //c.params6.from_add( c.params2, c.params3 ).scale( -1 );
    vec3_div( params2, params1 ); //c.params2.from_div( c.params2, c.params1 );
    vec3_div( params3, params1 ); // c.params3.from_div( c.params3, c.params1 );

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // mie scattering phase constants
    let g = (1 - props.pollution) * 0.2 + 0.75;
    params1[3] = (1 - g)**2 / ( 4 * Math.PI );
    params2[3] = -2 * g;
    params3[3] = 1 + g**2;

    const planet_radius = props.planetRadius * props.planetScale;
    const atmo_radius   = planet_radius + props.atmosphereThickness * props.atmosphereScale;
    params4[0] = planet_radius;
    params4[1] = atmo_radius * atmo_radius;
    params4[2] = 0.15 + 0.75 * (0.5);
    params4[3] = atmo_radius * atmo_radius - planet_radius * planet_radius;

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // sun disk cutoff
    params1[1]  = -(1 - 0.015 * props.diskRadius);
    params1[0]  = 1 / (1 + params1[1]);
    params1[1] *= params1[0];

    //params5.set( c.brightness, c.brightness, c.brightness, props.diskIntensity );
    params5[0] = props.brightness;
    params5[1] = props.brightness;
    params5[2] = props.brightness;
    params5[3] = props.diskIntensity;

    params6[3] = clarity * 3 / (16 * Math.PI);
}

// #region MATH FUNCTIONS
function vec3_fromPolar( lon, lat, out=null ) {
    let phi 	= ( 90 - lat ) * 0.01745329251, // deg 2 rad
        theta 	= lon * 0.01745329251,          // ( lon + 180 ) * 0.01745329251,
        sp     	= Math.sin( phi );

    out    = out || [0,0,0];
    out[0] = -sp * Math.sin( theta );
    out[1] = Math.cos( phi );
    out[2] = sp * Math.cos( theta );
    return out;
}

function vec3_add( a, b, out=null ){
    out      = out || a;
    out[ 0 ] = a[ 0 ] + b[ 0 ];
    out[ 1 ] = a[ 1 ] + b[ 1 ];
    out[ 2 ] = a[ 2 ] + b[ 2 ];
    return out;
}

function vec3_div( a, b, out=null ){
    out      = out || a;
    out[ 0 ] = ( b[ 0 ] !== 0 )? a[ 0 ] / b[ 0 ] : 0;
    out[ 1 ] = ( b[ 1 ] !== 0 )? a[ 1 ] / b[ 1 ] : 0;
    out[ 2 ] = ( b[ 2 ] !== 0 )? a[ 2 ] / b[ 2 ] : 0;
    return out;
}

function vec3_scale( a, s, out=null ){
    out      = out || a;
    out[ 0 ] = a[ 0 ] * s;
    out[ 1 ] = a[ 1 ] * s;
    out[ 2 ] = a[ 2 ] * s;
    return out;
}
// #endregion

// #region SHADER CODE
const VERT_SRC = `#version 300 es
in vec3 position;   // Vertex Position

uniform mat4 modelMatrix;       // Matrices should be filled in by THREE.JS Automatically.
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out vec3 frag_wpos;             // Fragment World Space Position

////////////////////////////////////////////////////////////////////////

void main() {
    vec4 wpos       = modelMatrix * vec4( position, 1.0 );
    frag_wpos       = wpos.xyz;
    gl_Position     = projectionMatrix * viewMatrix * wpos;
}`;


const FRAG_SRC = `#version 300 es
precision highp float;

////////////////////////////////////////////////////////////////////////

out     vec4 out_color;
in      vec3 frag_wpos;

uniform vec3 sun_pos;
uniform vec4 params1;
uniform vec4 params2;
uniform vec4 params3;
uniform vec4 params4;
uniform vec4 params5;
uniform vec4 params6;

////////////////////////////////////////////////////////////////////////

vec3 calcExtinction( float dist ){ return exp( dist * params6.xyz ); }

vec3 calcScattering(float cos_theta) {
    float r_phase   = (cos_theta * cos_theta) * params6.w + params6.w;
    float m_phase   = params1.w * pow(params2.w * cos_theta + params3.w, -1.5);
    return params2.xyz * r_phase + ( params3.xyz * m_phase );
}

float baseOpticalDepth(in vec3 ray) {
    float a1 = params4.x * ray.y;
    return sqrt( a1 * a1 + params4.w ) - a1;
}

float opticalDepth( vec3 pos, vec3 ray ){
    // the incoming position is in a space with the origin on the surface of the planet
    // convert to a space with the origin at the center of the planet
    pos.y    += params4.x;

    // ray-sphere intersection, assuming position is inside the sphere
    float a0  = params4.y - dot(pos, pos);
    float a1  = dot(pos, ray);
    return sqrt( a1 * a1 + a0 ) - a1;
}

vec3 skyColor( vec3 sky_dir, vec3 sun_pos ){
    vec3 sun_vector         = normalize( sun_pos );
    float cos_theta         = dot( sky_dir, sun_vector );

    //----------------------------------
    // optical depth along view ray
    float ray_dist          = baseOpticalDepth( sky_dir );

    //----------------------------------
    // extinction of light along view ray
    vec3 extinction         = calcExtinction(ray_dist);

    //----------------------------------
    // optical depth for incoming light hitting the view ray
    vec3 light_ray_pos      = sky_dir * ( ray_dist * params4.z );
    float light_ray_dist    = opticalDepth( light_ray_pos, sun_vector );
    
    //----------------------------------
    // optical depth for edge of atmosphere:
    // this handles the case where the sun is low in the sky and
    // the view is facing away from the sun; in this case the distance
    // the light needs to travel is much greater
    float light_ray_dist_full = opticalDepth( sky_dir * ray_dist, sun_vector );
    light_ray_dist            = max( light_ray_dist, light_ray_dist_full );

    //----------------------------------
    // cast a ray towards the sun and calculate the incoming extincted light
    vec3 incoming_light     = calcExtinction(light_ray_dist);
    
    //----------------------------------
    // calculate the in-scattering
    vec3 scattering         = calcScattering(cos_theta);
    scattering             *= 1.0 - extinction;

    //----------------------------------
    // combine
    vec3 in_scatter         = incoming_light * scattering;

    //----------------------------------
    // sun disk
    float sun_strength      = clamp(cos_theta * params1.x + params1.y, 0.0, 1.0);
    sun_strength           *= sun_strength;
    vec3 sun_disk           = extinction * sun_strength;

    //----------------------------------
    return params5.xyz * ( params5.w * sun_disk + in_scatter );
}

////////////////////////////////////////////////////////////////////////

void main(){
    vec3 domeColor = skyColor( normalize( frag_wpos ), sun_pos );
    out_color      = vec4( domeColor , 1.0 );
    //out_color      = vec4( 1.0, 1.0, 1.0 , 1.0 );
}`;
// #endregion