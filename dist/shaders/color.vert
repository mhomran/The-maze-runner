#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color; // We added a new attribute color at the location after position
layout(location=3) in vec3 normal;

out vec3 v_world;
out vec3 v_normal;
out vec3 v_view;

uniform mat4 M;
uniform mat4 M_it;
uniform mat4 VP;
uniform vec3 cam_position;

out vec4 vertexColor; // Since vertex shaders do not draw, we need to pass the color data to the fragment shader

// uniform mat4 MVP; // This matrix will hold all of our transformation (Model, View and Projection)

void main(){
    vec4 world = M * vec4(position, 1.0f);
    gl_Position = VP * world; 
    v_world = world.xyz;
    v_normal = (M_it * vec4(normal, 0.0f)).xyz;
    v_view = cam_position - world.xyz;

    // gl_Position = MVP * vec4(position, 1.0f); // Just multiply by this matrix and..... welcome to the 3rd Dimension
    vertexColor = color; // Pass the color to the fragment shader
}
