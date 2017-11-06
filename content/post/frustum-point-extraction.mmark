+++
date = "2016-10-23T19:14:32+01:00"
draft = false
title = "Three Methods to Extract Frustum Points"
tags = [ "math" ]
+++

Getting frustum points in world-space can be useful in a number of scenarios, such as debug visualisation or building a coarse volume around a partition in your frustum. Each method can be used depending what information you have available to you and what you want to avoid recalculating.

<!--more-->

##### Reverse Projection

If you have access to the world to clip-space matrix you can invert it and transform the clip-space frustum cube back into world-space:

```cpp
// Full 4x4 inverse, can't use an affine inverse optimisation
float4x4 clip_to_world = inverse(world_to_clip);

// Homogenous points for source cube in clip-space
// With -1 to 1 in x/y and 0 to 1 in z (D3D)
float4 v[8] =
{
	{-1, -1, 0, 1},
	{-1,  1, 0, 1},
	{ 1,  1, 0, 1},
	{ 1, -1, 0, 1},
	{-1, -1, 1, 1},
	{-1,  1, 1, 1},
	{ 1,  1, 1, 1},
	{ 1, -1, 1, 1}
};

for (int i = 0; i < 8; i++)
{
	// 4x4 * 4x1 matrix/vector multiplication 
	v[i] = transform(clip_to_world, v[i]);

	// Homogenous to cartesian conversion
	v[i] /= v[i].w;
}
```

This is an incredibly useful little snippet that can be used at any part of the pipeline without needing to know specifics of the projection.

##### Plane Intersection

If you have 6 planes which define the frustum in world-space, 3 planes at a time can be intersected to find each point in the frustum. In the general case, 3 intersecting planes either intersect at a point or a line. Given the 3 planes defined by their normal and distance from origin:

$$P_0 = \langle N_0, d_0 \rangle$$
$$P_1 = \langle N_1, d_1 \rangle$$
$$P_2 = \langle N_2, d_2 \rangle$$

Finding the intersection point is a case of solving the linear system:

$$P_0 \cdot I = 0$$
$$P_1 \cdot I = 0$$
$$P_2 \cdot I = 0$$

This can be written in matrix form:

$$\begin{bmatrix} N_0 & N_1 & N_2 \end{bmatrix} \cdot I = \begin{bmatrix} -d_0 \\\ -d_1 \\\ -d_2 \end{bmatrix}$$

Which then allows the intersection point to be found with a matrix inverse:

$$I = \begin{bmatrix} N_0 & N_1 & N_2 \end{bmatrix} ^{-1} \cdot \begin{bmatrix} -d_0 \\\ -d_1 \\\ -d_2 \end{bmatrix}$$

In code:

```cpp
bool IntersectPlanes(float4 P0, float4 P1, float4 P2, out float3 I)
{
	// Form the normal matrix
	float3x3 M;
	M[0][0] = P0.x;	M[1][0] = P0.y;	M[2][0] = P0.z;
	M[0][1] = P1.x;	M[1][1] = P1.y;	M[2][1] = P1.z;
	M[0][2] = P2.x;	M[1][2] = P2.y;	M[2][2] = P2.z;

	// Solve the linear system
	// If M is singular the three planes intersect with a line, not a point
	if (!invert(M))
		return false;

	// Transform the distance vector by the inverse to get the intersection point
	I.x = M[0][0] * -P0.w + M[1][0] * -P1.w + M[2][0] * -P2.w;
	I.y = M[0][1] * -P0.w + M[1][1] * -P1.w + M[2][1] * -P2.w;
	I.z = M[0][2] * -P0.w + M[1][2] * -P1.w + M[2][2] * -P2.w;

	return true;
}
```

The frustum points can then be found:

```cpp
v[0] = IntersectPlanes(planes[Near], planes[Left],  planes[Bottom]);
v[1] = IntersectPlanes(planes[Near], planes[Left],  planes[Top]);
v[2] = IntersectPlanes(planes[Near], planes[Right], planes[Top]);
v[3] = IntersectPlanes(planes[Near], planes[Right], planes[Bottom]);
v[4] = IntersectPlanes(planes[Far],  planes[Left],  planes[Bottom]);
v[5] = IntersectPlanes(planes[Far],  planes[Left],  planes[Top]);
v[6] = IntersectPlanes(planes[Far],  planes[Right], planes[Top]);
v[7] = IntersectPlanes(planes[Far],  planes[Right], planes[Bottom]);
```

It's safe to ignore the singular case of planes intersecting at a line if your frustum is a well defined convex hull. While this is useful if you only have access to the planes, a 3x3 inverse for each point is a bit excessive. It can be improved slightly when not considering degenerate cases:

```cpp
float3 IntersectPlanes(float4 P0, float4 P1, float4 P2)
{
	float3 bxc = cross(P1.xyz, P2.xyz);
	float3 cxa = cross(P2.xyz, P0.xyz);
	float3 axb = cross(P0.xyz, P1.xyz);
	float3 r = -P0.w * bxc - P1.w * cxa - P2.w * axb;
	return r * (1 / dot(P0.xyz, bxc));
}
```
<br>
##### Near/Far Plane Interpolation

This method is by far the fastest and tailored to a perspective projection. If you have access to the field of view and aspect ratio early in the pipeline, it's also the most accurate. Beyond that, all you need is the camera's world rotation:

```cpp
// Pull camera basis
float3 axis_x = camera_to_world[0];
float3 axis_y = camera_to_world[1];
float3 axis_z = camera_to_world[2];

// Near/far plane center points
float3 near_center = axis_z * zn;
float3 far_center = axis_z * zf;

// Get projected viewport extents on near/far planes
float e = tanf(fov_y * 0.5f);
float near_ext_y = e * zn;
float near_ext_x = near_ext_y * aspect_ratio;
float far_ext_y = e * zf;
float far_ext_x = far_ext_y * aspect_ratio;

// Points are just offset from the center points along camera basis
v[0] = near_center - axis_x * near_ext_x - axis_y * near_ext_y;
v[1] = near_center - axis_x * near_ext_x + axis_y * near_ext_y;
v[2] = near_center + axis_x * near_ext_x + axis_y * near_ext_y;
v[3] = near_center + axis_x * near_ext_x - axis_y * near_ext_y;
v[4] = far_center  - axis_x * far_ext_x  - axis_y * far_ext_y;
v[5] = far_center  - axis_x * far_ext_x  + axis_y * far_ext_y;
v[6] = far_center  + axis_x * far_ext_x  + axis_y * far_ext_y;
v[7] = far_center  + axis_x * far_ext_x  - axis_y * far_ext_y;
```

It's always helpful to keep each of these around and pick and choose based on situation. Add the clear case first and use a combination of experience and profiling to determine when stages need to be more tightly bound and generation needs to be optimised.