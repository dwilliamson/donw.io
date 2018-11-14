
WebGLSandbox = (function(){

// ====================================================================================== //
//    JAVASCRIPT UTILITIES
// ====================================================================================== //


function FatalError(error)
{
	var exception = { message: error };
	throw exception;
}


function ClearError(status_bar)
{
	status_bar.innerHTML = "Status: OK";
	status_bar.style.color = "FFF";
}


function SetError(status_bar, error)
{
	status_bar.innerHTML = "Status: <span style='color:#f44;font-weight:bold;'>Errors</span><br/>" + error;
}


function EndsWith(str, suffix)
{
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}


function GetDocument(filename, callback)
{
	// Create a new object for each request
	var req;
	if (window.XMLHttpRequest)
		req = new XMLHttpRequest();
	else
		req = new ActiveXObject("Microsoft.XMLHTTP");

	if (req)
	{
		// Setup the callback
		if (callback)
		{
			req.onreadystatechange = function()
			{
				if (req.readyState == 4 && req.status == 200)
					callback(req.responseText);
			}
		}

		// Kick-off a request with async if a callback is provided
		req.open("GET", filename, callback ? true : false);
		req.send();

		// Return the result when blocking
		if (!callback && req.status == 200)
			return req.responseText;
	}

	return null;
}


function HashString(str)
{
	var hash = 5381;
	for (var i = 0; i < str.length; i++)
	{
		var c = str.charCodeAt(i);
		hash = c + (hash << 6) + (hash << 16) - hash;
	}
	return hash;
}



// ====================================================================================== //
//    GEOMETRY UTILITIES
// ====================================================================================== //



function vec3_create(x, y, z)
{
	// Could update to latest gl-matrix but this will do for now
	var v = vec3.create();
	v[0] = x;
	v[1] = y;
	v[2] = z;
	return v;
}


Basis = (function()
{
	function Basis(a, b)
	{
		// Input is either a vector or a line segment
		if (b)
		{
			this.vector = vec3.create();
			vec3.sub(this.vector, b, a);
		}
		else
		{
			this.vector = vec3_create(a[0], a[1], a[2]);
		}

		// Axis is normal
		this.z = vec3_create(this.vector[0], this.vector[1], this.vector[2]);
		vec3.normalize(this.z, this.z);

		// Perpendicular to fixed up
		if (Math.abs(this.vector[1]) < 0.99)
			var up = vec3_create(0, 1, 0);
		else	
			var up = vec3_create(this.vector[1], 0, 0);
		this.x = vec3.create();
		vec3.cross(this.x, this.z, up);
		vec3.normalize(this.x, this.x);

		// Perpendicular to prior vectors
		this.y = vec3.create();
		vec3.cross(this.y, this.x, this.z);
		vec3.normalize(this.y, this.y);
	}

	return Basis;
})();


var IndexType = {
	TRIANGLE_STRIP : 0,
	TRIANGLE_LIST : 1,
};


Geometry = (function()
{
	function Geometry(index_type, vertices, indices)
	{
		this.IndexType = index_type;
		this.Vertices = vertices;
		this.Indices = indices;
	}

	return Geometry;
})();


function CreatePlaneGeometry(scale, nb_vertices_x)
{
	var positions = new Array();

	// Generate a linear array of vertices
	var mid = scale / 2.0;
	scale *= (1.0 / (nb_vertices_x - 1.0));
	for (var y = 0, i = 0; y < nb_vertices_x; y++)
	{
		for (var x = 0; x < nb_vertices_x; x++, i++)
		{
			// Calculate position
			var p = vec3.create();
			p[0] = x * scale - mid;
			p[1] = 1;
			p[2] = y * scale - mid;
			positions.push(p);
		}
	}

	var indices = new Array();

	// Triangle strip the plane
	for (var y = 0; y < nb_vertices_x - 1; y++)
	{
		// Strip-join double-tap
		var index = y * nb_vertices_x;
		indices.push(index);

		// Strip this row
		for (var x = 0; x < nb_vertices_x; x++)
		{
			indices.push(index);
			indices.push(index + nb_vertices_x);
			index++;
		}

		// Strip-join double-tap
		indices.push((index - 1) + nb_vertices_x);
	}

	return new Geometry(IndexType.TRIANGLE_STRIP, positions, indices);
}


function CreateCubeGeometry(scale_x, nb_vertices_x)
{
	var vertices = new Array();
	var indices = new Array();

	// Iterate over every face on the box
	for (var i = 0; i < 6; i++)
	{
		var axis = Math.floor(i / 2);
		var angle = (i & 1) ? Math.PI / 2 : -Math.PI / 2;
		var side = (i & 1) ? 1.0 : -1.0;

		var scale = vec3.create();
		var rotation = mat4.create();
		var position = vec3.create();

		// Determine the scale, rotation and position for the plane vertices
		vec3.set(scale, scale_x, 1, scale_x);
		switch (axis)
		{
			case 0:
				mat4.rotateZ(rotation, rotation, angle);
				vec3.set(position, scale_x * side, 0, 0);
				break;
			case 1:
				mat4.rotateX(rotation, rotation, angle + Math.PI / 2);
				vec3.set(position, 0, scale_x * side, 0);
				break;
			case 2:
				mat4.rotateX(rotation, rotation, angle);
				vec3.set(position, 0, 0, scale_x * side);
				break;
		}

		// Generate a plane for each face and transform its vertices to fit the face
		var plane_geom = CreatePlaneGeometry(1, nb_vertices_x);
		var plane_vertices = plane_geom.Vertices;
		for (var j = 0; j < plane_vertices.length; j++)
		{
			var v = plane_vertices[j];
			vec3.mul(v, v, scale);
			vec3.transformMat4(v, v, rotation);
		}

		// Merge
		// Indices have already been double-tapped for join
		var plane_indices = plane_geom.Indices;
		for (var j = 0; j < plane_indices.length; j++)
			indices.push(plane_indices[j] + vertices.length);
		vertices = vertices.concat(plane_vertices);
	}

	return new Geometry(IndexType.TRIANGLE_STRIP, vertices, indices);
}


function CreateOctahedronFaceGeometry()
{
	// Just interested in the initial triangle
	var position_array = new Array();
	position_array.push(vec3_create(0, 1, 0));
	position_array.push(vec3_create(1, 0, 0));
	position_array.push(vec3_create(0, 0, 1));
	return new Geometry(IndexType.TRIANGLE_LIST, position_array, [ 0, 1, 2 ]);
}


function CreateOctahedronGeometry()
{
	// http://en.wikipedia.org/wiki/Octahedron
	// http://en.wikipedia.org/wiki/Octahedron#mediaviewer/File:Dual_Cube-Octahedron.svg
	// Octahedron is dual to the cube with a point in the centre of each of its faces

	// Create vertex positions on the 6 cube faces
	var positions = [
		[  0,  1,  0 ],
		[  0,  0, -1 ],
		[  1,  0,  0 ],
		[  0,  0,  1 ],
		[ -1,  0,  0 ],
		[  0, -1,  0 ],
	];
	var position_array = new Array();
	for (var i in positions)
	{
		var p = vec3.create();
		p[0] = positions[i][0];
		p[1] = positions[i][1];
		p[2] = positions[i][2];
		position_array.push(p);
	}

	// Link octahedron triangles
	var indices = [
		0, 1, 2,
		0, 2, 3,
		0, 3, 4,
		0, 4, 1,
		5, 1, 2,
		5, 2, 3,
		5, 3, 4,
		5, 4, 1
	];
	var index_array = new Array();
	for (var i in indices)
		index_array.push(indices[i]);

	return new Geometry(IndexType.TRIANGLE_LIST, position_array, index_array);
}


function CreateIcosahedronGeometry()
{
	// http://en.wikipedia.org/wiki/Icosahedron
	// http://en.wikipedia.org/wiki/Regular_icosahedron

	// Golden ratio
	var t = (1.0 + Math.sqrt(5.0)) / 2.0;

	// All permutations of (t, 1, 0) to generate vertices, including sign flips
	// Called "snub tetrahedron" construction
	var positions = [
		[ -1,  t,  0 ],
		[  1,  t,  0 ],
		[ -1, -t,  0 ],
		[  1, -t,  0 ],

		[  0, -1,  t ],
		[  0,  1,  t ],
		[  0, -1, -t ],
		[  0,  1, -t ],

		[  t,  0, -1 ],
		[  t,  0,  1 ],
		[ -t,  0, -1 ],
		[ -t,  0,  1 ]
	];

	// Positions don't lie on unit sphere so need normalising
	var position_array = new Array();
	for (var i in positions)
	{
		var p = vec3.create();
		p[0] = positions[i][0];
		p[1] = positions[i][1];
		p[2] = positions[i][2];
		vec3.normalize(p, p);
		position_array.push(p);
	}

	// Index list by Andreas Kahler
	// http://blog.andreaskahler.com/2009/06/creating-icosphere-mesh-in-code.html
	var indices = [
		// 5 faces around point 0
		0, 11, 5,
		0, 5, 1,
		0, 1, 7,
		0, 7, 10,
		0, 10, 11,

		// 5 adjacent faces
		1, 5, 9,
		5, 11, 4,
		11, 10, 2,
		10, 7, 6,
		7, 1, 8,

		// 5 faces around point 3
		3, 9, 4,
		3, 4, 2,
		3, 2, 6,
		3, 6, 8,
		3, 8, 9,

		// 5 adjacent faces
		4, 9, 5,
		2, 4, 11,
		6, 2, 10,
		8, 6, 7,
		9, 8, 1
	];
	var index_array = new Array();
	for (var i in indices)
		index_array.push(indices[i]);

	return new Geometry(IndexType.TRIANGLE_LIST, position_array, index_array);
}


function AddLinePrimitives(a, b, axis, position_array, index_array)
{
	// Extrude endpoints of a
	var a_paxis = vec3.create();
	var a_naxis = vec3.create();
	vec3.add(a_paxis, a, axis);
	vec3.sub(a_naxis, a, axis);

	// Extrude endpoints of b
	var b_paxis = vec3.create();
	var b_naxis = vec3.create();
	vec3.add(b_paxis, b, axis);
	vec3.sub(b_naxis, b, axis);

	// Add triangle positions
	var start_index = position_array.length;
	position_array.push(a_naxis);
	position_array.push(a_paxis);
	position_array.push(b_paxis);
	position_array.push(b_paxis);
	position_array.push(b_naxis);
	position_array.push(a_naxis);

	// Add triangle list indices
	for (var i = 0; i < 6; i++)
		index_array.push(start_index + i);
}


function CreateSphereGeometry(radius, subdivisions)
{
	var geom = CreateOctahedronGeometry();
	
	// Subdivide and sphere project after

	for (var i = 0; i < subdivisions; i++)
		SubdivideGeometryTriangleList(geom, false);

	ProjectVerticesToSphere(geom.Vertices, radius);

	return geom;
}


function AddCirclePrimitive(center, basis, radius, position_array, index_array, divisions)
{
	// Center point
	var center_index = position_array.length;
	position_array.push(center);
	var index = position_array.length;

	if (divisions == null)
		divisions = 16;

	var o = vec3.create();
	var end = 3.1412 * 2;
	var step = end / divisions;
	var t = 0;
	for (var i = 0; i < divisions + 1; i++)
	{
		var u = Math.sin(t) * radius;
		var v = Math.cos(t) * radius;

		var p = vec3.create();
		vec3.scale(o, basis.x, u);
		vec3.add(p, center, o);
		vec3.scale(o, basis.y, v);
		vec3.add(p, p, o);

		position_array.push(p);

		index_array.push(index - 1);
		index_array.push(index);
		index_array.push(center_index);
		index++;

		t += step;
	}
}


function AddCylinderPrimitive(a, b, basis, radius, position_array, index_array)
{
	// Center point vertices of cylinder caps
	var a_center_index = position_array.length;
	position_array.push(a);
	position_array.push(b);

	var o = vec3.create();
	var end = 3.1412 * 2;
	var step = end / 8.0;
	var t = 0;
	for (var i = 0; i < 9; i++)
	{
		var u = Math.sin(t) * radius;
		var v = Math.cos(t) * radius;

		// Bottom vertex
		var p0 = vec3.create();
		vec3.scale(o, basis.x, u);
		vec3.add(p0, a, o);
		vec3.scale(o, basis.y, v);
		vec3.add(p0, p0, o);
		position_array.push(p0);

		// Top vertex
		var p1 = vec3.create();
		vec3.add(p1, p0, basis.vector);
		position_array.push(p1);

		if (t > 0)
		{
			// Bottom triangle
			var index = position_array.length;
			index_array.push(index - 4);
			index_array.push(index - 2);
			index_array.push(a_center_index);

			// Top triangle
			index_array.push(index - 3);
			index_array.push(index - 1);
			index_array.push(a_center_index);

			// Side quad
			index_array.push(index - 4);
			index_array.push(index - 2);
			index_array.push(index - 1);
			index_array.push(index - 1);
			index_array.push(index - 3);
			index_array.push(index - 4);
		}

		t += step;
	}
}


function AddConePrimitive(a, b, basis, radius, position_array, index_array)
{
	// Center point vertexs of cone
	var a_center_index = position_array.length;
	position_array.push(a);
	var b_center_index = position_array.length;
	position_array.push(b);

	var o = vec3.create();
	var end = 3.1412 * 2;
	var step = end / 8.0;
	var t = 0;
	for (var i = 0; i < 9; i++)
	{
		var u = Math.sin(t) * radius;
		var v = Math.cos(t) * radius;

		// Base vertex
		var p0 = vec3.create();
		vec3.scale(o, basis.x, u);
		vec3.add(p0, a, o);
		vec3.scale(o, basis.y, v);
		vec3.add(p0, p0, o);
		position_array.push(p0);

		if (t > 0)
		{
			// Bottom triangle
			var index = position_array.length;
			index_array.push(index - 2);
			index_array.push(index - 1);
			index_array.push(a_center_index);

			// Side triangle
			index_array.push(index - 1);
			index_array.push(index - 2);
			index_array.push(b_center_index);
		}

		t += step;
	}
}


function CreateLineGeometry(a, b, size, cone_size, dash_size)
{
	var position_array = new Array();
	var index_array = new Array();

	// Line basis
	var basis = new Basis(a, b);

	var end_point = b;
	if (cone_size)
	{
		// Recalculate line end point for cone tip
		var cone_axis = vec3.create();
		vec3.scale(cone_axis, basis.z, cone_size * 2);
		end_point = vec3.create();
		vec3.sub(end_point, b, cone_axis);
		vec3.sub(basis.vector, end_point, a);

		// Create cone endpoint
		AddConePrimitive(end_point, b, basis, cone_size, position_array, index_array);
	}

	if (dash_size)
	{
		// The basis vector is used to size the cylinder so needs to be scaled
		// to the size of the dash
		var length = vec3.length(basis.vector);
		vec3.scale(basis.vector, basis.z, dash_size);

		var last_pos = null;
		var draw = false;
		for (var t = 0; t < length; t += dash_size)
		{
			var pos = vec3.create();
			vec3.scale(pos, basis.z, t);
			vec3.add(pos, pos, a);

			if (last_pos != null && draw)
			{
				AddCylinderPrimitive(last_pos, pos, basis, size, position_array, index_array);
			}

			// Toggle rendering
			last_pos = pos;
			draw ^= true;
		}
	}
	else
	{
		AddCylinderPrimitive(a, end_point, basis, size, position_array, index_array);
	}

	// TODO:: draw bit left over

	return new Geometry(IndexType.TRIANGLE_LIST, position_array, index_array);
}


function CreateCircleLineGeometry(divisions, radius, thickness)
{
	var position_array = new Array();
	var index_array = new Array();

	var end = 3.1412 * 2;
	var step = end / divisions;
	var t = 0;
	var last_pos = null;

	for (var i = 0; i < divisions + 1; i++)
	{
		var u = Math.sin(t) * radius;
		var v = Math.cos(t) * radius;

		var pos = vec3_create(u, v, 0);
		if (last_pos != null)
		{
			// Line basis
			var axis = vec3.create();
			vec3.sub(axis, pos, last_pos);
			var basis = new Basis(axis);

			AddCylinderPrimitive(last_pos, pos, basis, thickness, position_array, index_array);
		}
		last_pos = pos;

		t += step;
	}

	return new Geometry(IndexType.TRIANGLE_LIST, position_array, index_array);
}


function CreateWireframeIndices(index_type, indices)
{
	var wireframe_indices = new Array();

	switch (index_type)
	{
		case IndexType.TRIANGLE_STRIP:
			var index_limit = indices.length - 2;
			var index_skip = 1;
			break;
		case IndexType.TRIANGLE_LIST:
			var index_limit = indices.length;
			var index_skip = 3;
			break;
	}

	for (var i = 0; i < index_limit; i += index_skip)
	{
		// Strip/list unpack
		var i0 = indices[i];
		var i1 = indices[i + 1];
		var i2 = indices[i + 2];

		// Ignore degenerate strip joins
		if (i0 == i1 || i0 == i2 || i1 == i2)
			continue;

		// Pack as a line list
		wireframe_indices.push(i0);
		wireframe_indices.push(i1);
		wireframe_indices.push(i1);
		wireframe_indices.push(i2);
		wireframe_indices.push(i2);
		wireframe_indices.push(i0);
	}

	return wireframe_indices;
}


function QuadrifyWireframeIndices(indices)
{
	// Assuming the a triangulated list of quads, pull out the quad diagonals
	var filtered_indices = new Array();
	function Add(base)
	{
		for (var i = 1; i < arguments.length; i++)
			filtered_indices.push(indices[base + arguments[i]]);
	}
	for (var i = 0; i < indices.length; i += 12)
		Add(i, 0, 1, 4, 5, 8, 9, 10, 11);
	return filtered_indices;
}


function SubdivideTriangleList(positions, indices, do_slerp)
{
	var out_indices = new Array();

	// Use an object as an associative map of edge pairs
	// Not ideal as JS will convert the integer keys to strings, but, it's quick and dirty...
	var MAX_NB_INDICES = 32768;
	var edge_splits = new Object();

	function make_edge_key(i0, i1)
	{
		// Ensure lowest edge index is first to ensure consistent key between different edge directions
		if (i1 < i0)
		{
			var temp = i0;
			i0 = i1;
			i1 = temp;
		}

		// Check for overflow
		if (i1 >= MAX_NB_INDICES)
			throw new Error("Edge split table not big enough to handle index: " + i1);

		return i0 * MAX_NB_INDICES + i1;
	}

	function slerp(out, a, b, t)
	{
		// Cosine of angle between two vectors
		var cos_theta = vec3.dot(a, b);
		cos_theta = Math.min(Math.max(cos_theta, -1), 1);

		// Calculate interpolated angle
		var theta = Math.acos(cos_theta) * t;

		//var sin_theta = Math.sin(theta);
		//var s0 = Math.sin((1 - t) * theta) / sin_theta;
		//var s1 = Math.sin(t * theta) / sin_theta;

		var relative = vec3.create();
		vec3.scale(relative, a, cos_theta);
		vec3.sub(relative, b, relative);
		vec3.normalize(relative, relative);

		vec3.scale(relative, relative, Math.sin(theta));
		vec3.scale(out, a, Math.cos(theta));
		vec3.add(out, out, relative);
	}

	function split_edge(positions, i0, i1)
	{
		// Check first to see if the edge has been split before
		var edge_key = make_edge_key(i0, i1);
		var edge_split = edge_splits[edge_key];
		if (edge_split !== undefined)
			return edge_split;

		// Lookup edge vertex positions
		var p0 = positions[i0];
		var p1 = positions[i1];

		// Generate a midpoint
		var p01 = vec3.create();
		if (do_slerp)
			slerp(p01, p0, p1, 0.5);
		else
			vec3.lerp(p01, p0, p1, 0.5);

		// Add the new vertex position and index to the edge split table
		positions.push(p01);
		edge_split = positions.length - 1;
		edge_splits[edge_key] = edge_split;

		return edge_split;
	}

	for (var i = 0; i < indices.length; i += 3)
	{
		// Get vertex indices of the triangle
		var i0 = indices[i + 0];
		var i1 = indices[i + 1];
		var i2 = indices[i + 2];

		// Split the edges of the triangle
		var i01 = split_edge(positions, i0, i1);
		var i12 = split_edge(positions, i1, i2);
		var i20 = split_edge(positions, i2, i0);

		// Add indices for the 4 new triangles
		var new_indices = [
			i0,  i01, i20,
			i01, i1,  i12,
			i20, i01, i12,
			i20, i12, i2 
		];
		for (var j in new_indices)
			out_indices.push(new_indices[j]);
	}

	return out_indices;
}


function SubdivideGeometryTriangleList(geometry, do_slerp)
{
	if (geometry.IndexType == IndexType.TRIANGLE_LIST)
		geometry.Indices = SubdivideTriangleList(geometry.Vertices, geometry.Indices, do_slerp);
}


function ProjectVerticesToSphere(vertices, radius)
{
	for (var i in vertices)
	{
		var vertex = vertices[i];
		vec3.normalize(vertex, vertex);
		vec3.scale(vertex, vertex, radius);
	}
}



// ====================================================================================== //
//    WEBGL UTILITIES
// ====================================================================================== //


function CreateShader(gl, type, source)
{
	// Create and compile the shader
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	// Report any compilation errors
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
		FatalError(gl.getShaderInfoLog(shader));

	return shader;
}


function LoadShader(gl, filename)
{
	// Block loading the shader
	var source = GetDocument(filename, null);
	if (!source)
		FatalError("Failed to load shader: " + filename);

	// Decide the shader type from the filename extension
	var type = gl.FRAGMENT_SHADER;
	if (EndsWith(filename.toLowerCase(), ".vsh"))
		type = gl.VERTEX_SHADER;

	return CreateShader(gl, type, source);
}


function CreateVertexBuffer(gl, vertices)
{
	// Create the vertex buffer
	var vbuffer = gl.createBuffer();
	if (!vbuffer)
		FatalError("Failed to create vertex buffer");

	// Concatenate into a float32 array
	var all_vertices = new Float32Array(vertices.length * 3);
	for (var i = 0; i < vertices.length; i++)
		all_vertices.set(vertices[i], i * 3);

	// Set the vertex buffer data
	gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);
	gl.bufferData(gl.ARRAY_BUFFER, all_vertices, gl.STATIC_DRAW);
	vbuffer.nb_vertices = vertices.length;

	return vbuffer;
}


function CreateIndexBuffer(gl, indices)
{
	// Create the index buffer
	var ibuffer = gl.createBuffer();
	if (!ibuffer)
		FatalError("Failed to create index buffer");

	// Set the index buffer data
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	ibuffer.nb_indices = indices.length;

	return ibuffer;
}


function GetShaderUniform(gl, program, uniform_name, optional)
{
	var uniform = gl.getUniformLocation(program, uniform_name);
	if (uniform == null && !optional)
		FatalError("Couldn't locate uniform: " + uniform_name);

	return uniform;
}


function SetShaderUniformFloat(gl, program, uniform_name, value, optional)
{
	var uniform = GetShaderUniform(gl, program, uniform_name, optional);
	if (uniform)
		gl.uniform1f(uniform, value);
}


function SetShaderUniformVector3(gl, program, uniform_name, vector, optional)
{
	var uniform = GetShaderUniform(gl, program, uniform_name, optional);
	if (uniform)
		gl.uniform3fv(uniform, vector);
}


function SetShaderUniformMatrix4(gl, program, uniform_name, matrix, optional)
{
	var uniform = GetShaderUniform(gl, program, uniform_name, optional);
	if (uniform)
		gl.uniformMatrix4fv(uniform, false, matrix);
}


function InitWebGL(canvas, status_bar)
{
	// Get WebGL context
	var gl = null;
	try
	{
		var flags = { antialias: true, stencil: true };
		gl = canvas.getContext("webgl", flags) || canvas.getContext("experimental-webgl", flags);
	}
	catch (e)
	{
	}

	// Blitz page on error
	if (!gl)
		SetError(status_bar, "Couldn't initialise WebGL");

	return gl;
}



// ====================================================================================== //
//    INPUT UTILITIES
// ====================================================================================== //



var Keys = {

	// ASCII Keys
	W: 87,
	S: 83,
	A: 65,
	D: 68,
	Q: 81,
	E: 69,

	SPACE:32,
	SHIFT:16,

	// Hijack with mouse keys
	MB:0,
};


Input = (function()
{
	function Input(container)
	{
		// Initialise default state
		this.KeyState = [ ];
		this.MouseDelta = [ 0, 0 ];
		this.LastMouseDragPos = null;
		this.ActiveTouchID = null;

		// Set event handlers
		var self = this;
		container.onkeydown = function(ev) { OnKeyDown(self, ev); };
		container.onkeyup = function(ev) { OnKeyUp(self, ev); };
		container.onmousedown = function(ev) { OnMouseDown(self, ev); };
		container.onmouseup = function(ev) { OnMouseUp(self, ev); };
		container.onmouseout = function(ev) { OnMouseOut(self, ev); };
		container.onmousemove = function(ev) { OnMouseMove(self, ev); };
		container.ontouchstart = function(ev) { OnTouchStart(self, ev); };
		container.ontouchend = function(ev) { OnTouchEnd(self, ev); };
		container.ontouchmove = function(ev) { return OnTouchMove(self, ev); };
	}

	// Listening for keyboard events requires tabindex set on the canvas so that it can focus
	function OnKeyDown(self, ev)
	{
		self.KeyState[ev.keyCode] = true;
	}
	function OnKeyUp(self, ev)
	{
		self.KeyState[ev.keyCode] = false;
	}

	// Handle mouse presses
	function OnMouseDown(self, ev)
	{
		self.KeyState[Keys.MB] = true;
		self.LastMouseDragPos = [ ev.clientX, ev.clientY ];
	}
	function OnMouseUp(self, ev)
	{
		self.KeyState[Keys.MB] = false;
		self.LastMouseDragPos = null;
	}
	function OnMouseOut(self, ev)
	{
		self.KeyState[Keys.MB] = false;
		self.LastMouseDragPos = null;
	}

	// Handle mouse move dragging
	function OnMouseMove(self, ev)
	{
		if (self.LastMouseDragPos)
		{
			self.MouseDelta[0] += ev.clientX - self.LastMouseDragPos[0];
			self.MouseDelta[1] += ev.clientY - self.LastMouseDragPos[1];
			self.LastMouseDragPos[0] = ev.clientX;
			self.LastMouseDragPos[1] = ev.clientY;
		}
	}
	
	function OnTouchStart(self, ev)
	{
		// Use position of the first touch in the list
		var touch = ev.changedTouches[0];
		self.KeyState[Keys.MB] = true;
		self.LastMouseDragPos = [ touch.pageX, touch.pageY ];
		self.ActiveTouchID = touch.identifier;
	}
	function OnTouchEnd(self, ev)
	{
		self.KeyState[Keys.MB] = false;
		self.LastMouseDragPos = null;
		self.ActiveTouchID = null;
	}
	function OnTouchMove(self, ev)
	{
		// Find the currently active touch to update movement
		for (var i = 0; i < ev.changedTouches.length; i++)
		{
			var touch = ev.changedTouches[i];
			if (touch.identifier == self.ActiveTouchID)
			{
				self.MouseDelta[0] += touch.pageX - self.LastMouseDragPos[0];
				self.MouseDelta[1] += touch.pageY - self.LastMouseDragPos[1];
				self.LastMouseDragPos[0] = touch.pageX;
				self.LastMouseDragPos[1] = touch.pageY;
				return false;
				break;
			}
		}
	}
	
	return Input;
})();



// ====================================================================================== //
//    MAIN PROGRAM
// ====================================================================================== //



// Create a vector colour enum
var Colours = {
	BLACK : [ 0, 0, 0 ],
	WHITE : [ 1, 1, 1 ],
};

// Replace RGB triplets with vectors
for (var i in Colours)
{
	var rgb = Colours[i];
	var vec = vec3.create();
	vec3.set(vec, rgb[0], rgb[1], rgb[2]);
	Colours[i] = vec;
}


var DrawType = {
	SOLID : 0,
	WIREFRAME : 1,
	WIREFRAME_TRIS : 3,
	WIREFRAME_QUADS : 5,
};


// This kept around only during a single a session and cleared between edit sessions
// It exists purely to keep old shaders alive while their new replacements have errors
var g_ShaderMap = [ ];


FloatingText = (function()
{
	function FloatingText(parent, text, position, normal)
	{
		// Create the text node and attach it to the parent
		this.div = document.createElement("div");
		this.div.className = "wglsbx-FloatingText";
		var html = katex.renderToString(text, { throwOnError: false });
		this.div.innerHTML = "<span style='font-size:20px'>" + html + "</span>";
		parent.appendChild(this.div);

		// Copy position to vec4 ready for perspective transform
		this.Position = vec4.create();
		this.Position[0] = position[0];
		this.Position[1] = position[1];
		this.Position[2] = position[2];
		this.Position[3] = 1;

		// Copy the optional normal
		if (normal)
		{
			this.Normal = vec3.create();
			this.Normal[0] = normal[0];
			this.Normal[1] = normal[1];
			this.Normal[2] = normal[2]
		}
	}

	return FloatingText;
	
})();


Mesh = (function()
{
	function Mesh(gl, draw_type, geometry, program)
	{
		// Cache for property access
		this.gl = gl;

		this.DrawType = draw_type;

		// Create the data buffers
		this.IndexType = geometry.IndexType;
		this.VertexBuffer = CreateVertexBuffer(gl, geometry.Vertices);
		this.IndexBuffer = CreateIndexBuffer(gl, geometry.Indices);

		// Create wireframe index buffers if needed
		if (draw_type & DrawType.WIREFRAME)
		{
			var wireframe_indices = CreateWireframeIndices(geometry.IndexType, geometry.Indices);
			if (draw_type == DrawType.WIREFRAME_QUADS)
				wireframe_indices = QuadrifyWireframeIndices(wireframe_indices);
			this.WireframeIndexBuffer = CreateIndexBuffer(gl, wireframe_indices);
		}

		this.Program = program;
		this.FloatUniforms = { };
		this.Vec3Uniforms = { };
		
		// Set initial position on the origin
		this.Position = vec3.create();
		this.ObjectToWorld = mat4.create();
		this.SetPosition(0, 0, 0);

		// Any gl state
		this.CullingEnabled = false;
		this.CullMode = gl.BACK;
		this.StencilOpFail = gl.KEEP;
		this.StencilOpZFail = gl.KEEP;
		this.StencilOpZPass = gl.KEEP;
		this.StencilFunc = gl.ALWAYS;
		this.StencilRef = 0;

		this.Colour = Colours.WHITE;
		this.FillColour = Colours.BLACK;
	}


	Mesh.prototype.SetPosition = function(x, y ,z)
	{
		vec3.set(this.Position, x, y, z);
		mat4.identity(this.ObjectToWorld);
		mat4.translate(this.ObjectToWorld, this.ObjectToWorld, this.Position);
	}

	return Mesh;

})();


var CameraType = {
	FLY : 0,
	ROTATE : 1,
};


Transform = (function()
{
	function Transform(x, y, z, rx, ry, rz)
	{
		this.Position = vec3_create(x, y, z);
		this.Rotation = vec3_create(rx, ry, rz);

		this.PositionMatrix = mat4.create();
		this.RotationMatrix = mat4.create();

		this.UpdateMatrices();
	}


	Transform.prototype.UpdatePositionMatrix = function()
	{
		mat4.identity(this.PositionMatrix);
		mat4.translate(this.PositionMatrix, this.PositionMatrix, this.Position);
		return this.PositionMatrix;
	}


	Transform.prototype.UpdateRotationMatrix = function()
	{
		mat4.identity(this.RotationMatrix);
		mat4.rotateY(this.RotationMatrix, this.RotationMatrix, this.Rotation[1]);
		mat4.rotateX(this.RotationMatrix, this.RotationMatrix, this.Rotation[0]);
		return this.RotationMatrix;
	}


	Transform.prototype.UpdateMatrices = function()
	{
		this.UpdatePositionMatrix();
		this.UpdateRotationMatrix();
	}


	return Transform;
})();


Scene = (function()
{
	function Scene(gl, vshader, fshader, canvas, overlay)
	{
		this.Overlay = overlay;

		// Create matrices
		this.CameraToWorld = mat4.create();
		this.WorldToCamera = mat4.create();

		// List of objects to render in the scene
		this.Meshes = [ ];
		this.FloatingTexts = [ ];

		// Bind the scene to the context
		this.gl = gl;

		// Embed the program in the scene
		this.VertexShader = vshader;
		this.FragmentShader = fshader;

		// Get canvas dimensions
		this.CanvasWidth = canvas.width;
		this.CanvasHeight = canvas.height;
		this.AspectRatio = this.CanvasWidth / this.CanvasHeight;

		// Set a default perspective matrix
		this.CameraToClip = mat4.create();
		mat4.perspective(this.CameraToClip, 45, this.AspectRatio, 0.1, 100.0);

		// Set default camera orientation
		this.FlyCameraTransform = new Transform(0, 0, 3, 0, 0, 0);
		this.RotateCameraTransform = new Transform(0, 0, 3, 0, 0, 0);
		this.CameraTransform = this.RotateCameraTransform;
		this.CameraType = CameraType.ROTATE;

		this.UpdateMatrices();
	}


	Scene.prototype.UpdateMatrices = function()
	{
		this.CameraTransform.UpdateMatrices();

		// Calculate view matrix from the camera
		if (this.CameraType == CameraType.ROTATE)
			mat4.mul(this.CameraToWorld, this.CameraTransform.RotationMatrix, this.CameraTransform.PositionMatrix);
		else
			mat4.mul(this.CameraToWorld, this.CameraTransform.PositionMatrix, this.CameraTransform.RotationMatrix);
		mat4.invert(this.WorldToCamera, this.CameraToWorld);
	}


	Scene.prototype.SetCameraPosition = function(x, y, z)
	{
		vec3.set(this.FlyCameraTransform.Position, x, y, z);
		vec3.set(this.RotateCameraTransform.Position, x, y, z);
	}


	Scene.prototype.SetCameraRotation = function(x, y, z)
	{
		vec3.set(this.FlyCameraTransform.Rotation, x, y, z);
		vec3.set(this.RotateCameraTransform.Rotation, x, y, z);
	}


	Scene.prototype.AddMesh = function(draw_type, geometry, vshader_source, fshader_source)
	{
		var gl = this.gl;

		// Optionally compile a custom vertex shader for the mesh
		vshader = this.VertexShader;
		if (vshader_source !== undefined)
		{
			var custom_vshader = CreateShader(gl, gl.VERTEX_SHADER, vshader_source);
			if (custom_vshader != null)
				vshader = custom_vshader;
		}

		// Optionally compile a custom fragment shader for the mesh
		fshader = this.FragmentShader;
		if (fshader_source !== undefined)
		{
			var custom_fshader = CreateShader(gl, gl.FRAGMENT_SHADER, fshader_source);
			if (custom_fshader != null)
				fshader = custom_fshader;
		}

		// Create the shader program
		var program = gl.createProgram();
		gl.attachShader(program, fshader);
		gl.attachShader(program, vshader);
		gl.linkProgram(program);

		// Return on any errors
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			FatalError("Link Error: " + gl.getProgramInfoLog(program));

		var mesh = new Mesh(gl, draw_type, geometry, program);
		this.Meshes.push(mesh);
		return mesh;
	}


	Scene.prototype.AddLineMesh = function(a, b, size, colour, cone_size, dash_size)
	{
		var g = CreateLineGeometry(a, b, size, cone_size, dash_size);
		var m = this.AddMesh(DrawType.WIREFRAME_TRIS, g);
		m.Colour = colour;
		m.FillColour = colour;
		return m;			
	}

	
	Scene.prototype.AddSphereMesh = function(center, radius, subdivisions, colour)
	{
		var g = CreateSphereGeometry(radius, subdivisions);
		var m = this.AddMesh(DrawType.SOLID, g);
		m.Colour = colour;
		m.FillColour = colour;
		m.SetPosition(center[0], center[1], center[2]);
		return m;
	}


	Scene.prototype.AddCircleLineMesh = function(divisions, radius, thickness, colour)
	{
		var g = CreateCircleLineGeometry(divisions, radius, thickness, colour);
		var m = this.AddMesh(DrawType.WIREFRAME_TRIS, g);
		m.Colour = colour;
		m.FillColour = colour;
		return m;
	}


	Scene.prototype.AddFloatingText = function(text, position, normal)
	{
		this.FloatingTexts.push(new FloatingText(this.Overlay, text, position, normal));
	}


	Scene.prototype.AddMeasure = function(a, b, col, perp_dist, text, x_text_shift, z_text_shift)
	{
		var basis = new Basis(a, b);
	
		// Perpendicular
		var perp = vec3_create(basis.y[0], basis.y[1], basis.y[2]);
		vec3.scale(perp, perp, perp_dist);
	
		// Perpendicular-shifted end points
		var a0 = vec3.create();
		vec3.add(a0, a, perp);
		var b0 = vec3.create();
		vec3.add(b0, b, perp);
	
		// Center point
		var c = vec3.create();
		vec3.add(c, a0, b0);
		vec3.scale(c, c, 0.5);
	
		// Inside line starting points
		var center_shift = vec3.create();
		vec3.scale(center_shift, basis.z, 0.15);
		var a1 = vec3.create();
		vec3.sub(a1, c, center_shift);
		var b1 = vec3.create();
		vec3.add(b1, c, center_shift);
	
		this.AddLineMesh(a1, a0, 0.001, col, 0.025, 0.02);
		this.AddLineMesh(b1, b0, 0.001, col, 0.025, 0.02);
	
		var text_shift_0 = vec3.create();
		vec3.scale(text_shift_0, basis.y, x_text_shift);
		var text_shift_1 = vec3.create();
		vec3.scale(text_shift_1, basis.z, z_text_shift);
		var t = vec3.create();
		vec3.add(t, c, text_shift_0);
		vec3.add(t, t, text_shift_1);
		this.AddFloatingText(text, t);
	}


	Scene.prototype.DrawObjects = function()
	{
		this.UpdateMatrices();

		for (i in this.Meshes)
		{
			var mesh = this.Meshes[i];
			this.DrawMesh(mesh);
		}

		var world_to_clip = mat4.create();
		mat4.mul(world_to_clip, this.CameraToClip, this.WorldToCamera);

		var world_to_camera_rotation = mat3.create();
		mat3.fromMat4(world_to_camera_rotation, this.WorldToCamera);

		var position = vec4.create();
		var normal = vec3.create();

		for (i in this.FloatingTexts)
		{
			var text = this.FloatingTexts[i];

			// If the text has a normal, use that to backface cull
			if (text.Normal)
			{
				vec3.transformMat3(normal, text.Normal, world_to_camera_rotation);
				var visible = normal[2] > 0;
				text.div.style.display = visible ? "" : "none";
			}

			vec4.transformMat4(position, text.Position, world_to_clip);

			position[0] /= position[3];
			position[1] /= position[3];

			var x = (position[0] *  0.5 + 0.5) * this.CanvasWidth;
			var y = (position[1] * -0.5 + 0.5) * this.CanvasHeight;

			text.div.style.left = Math.floor(x) + "px";
			text.div.style.top = Math.floor(y) + "px";
		}
	}


	function DrawMeshPass(self, mesh, type, colour)
	{
		var gl = self.gl;

		// Concatenate camera/mesh matrices
		var object_to_camera = mat4.create();
		mat4.mul(object_to_camera, self.WorldToCamera, mesh.ObjectToWorld);
		var object_to_clip = mat4.create();
		mat4.mul(object_to_clip, self.CameraToClip, object_to_camera);

		// Apply program and set shader constants
		gl.useProgram(mesh.Program);
		SetShaderUniformMatrix4(gl, mesh.Program, "ObjectToClip", object_to_clip);
		SetShaderUniformVector3(gl, mesh.Program, "glColour", colour);

		// Set all mesh uniforms
		// To keep the interactive editing experience smooth with no exceptions, make all uniforms optional in the shader
		for (var name in mesh.FloatUniforms)
		{
			var value = mesh.FloatUniforms[name];
			SetShaderUniformFloat(gl, mesh.Program, name, value, optional=true);
		}
		for (var name in mesh.Vec3Uniforms)
		{
			var value = mesh.Vec3Uniforms[name];
			SetShaderUniformVec3(gl, mesh.Program, name, value, optional=true);
		}

		// Apply mesh-specific gl state
		if (mesh.CullingEnabled)
			gl.enable(gl.CULL_FACE);
		else
			gl.disable(gl.CULL_FACE);
		gl.cullFace(mesh.CullMode);
		gl.stencilOp(mesh.StencilOpFail, mesh.StencilOpZFail, mesh.StencilOpZPass);
		gl.stencilFunc(mesh.StencilFunc, mesh.StencilRef, 0xFF);
		gl.stencilMask(0xFF);

		// Setup the program attributes
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.VertexBuffer);
		var a_vpos = gl.getAttribLocation(mesh.Program, "glVertex");
		gl.enableVertexAttribArray(a_vpos);
		gl.vertexAttribPointer(a_vpos, 3, gl.FLOAT, false, 0, 0);

		// Decide which index buffer to use
		var ibuffer = mesh.IndexBuffer;
		if (type == gl.LINES)
			ibuffer = mesh.WireframeIndexBuffer;

		// Draw the mesh	
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuffer);
		gl.drawElements(type, ibuffer.nb_indices, gl.UNSIGNED_SHORT, 0);
	}


	Scene.prototype.DrawMesh = function(mesh)
	{
		var gl = this.gl;

		if (mesh.DrawType == DrawType.SOLID)
		{
			if (mesh.IndexType == IndexType.TRIANGLE_STRIP)
				DrawMeshPass(this, mesh, gl.TRIANGLE_STRIP, mesh.FillColour);
			else
				DrawMeshPass(this, mesh, gl.TRIANGLES, mesh.FillColour);
		}

		else if (mesh.DrawType & DrawType.WIREFRAME)
		{
			if (mesh.DrawType != DrawType.WIREFRAME)
			{
				gl.depthRange(0.01, 1);
				if (mesh.IndexType == IndexType.TRIANGLE_STRIP)
					DrawMeshPass(this, mesh, gl.TRIANGLE_STRIP, mesh.FillColour);
				else
					DrawMeshPass(this, mesh, gl.TRIANGLES, mesh.FillColour);
				gl.depthRange(0, 1);
			}

			DrawMeshPass(this, mesh, gl.LINES, mesh.Colour);
		}
	}

	return Scene;

})();


function DrawScene(gl, scene, input)
{
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Update camera rotation and reset mouse delta
	scene.CameraTransform.Rotation[0] -= input.MouseDelta[1] * 0.004;
	scene.CameraTransform.Rotation[1] -= input.MouseDelta[0] * 0.004;
	var rotation_matrix = scene.CameraTransform.UpdateRotationMatrix();
	input.MouseDelta[0] = 0;
	input.MouseDelta[1] = 0;

	// Construct movement vector frame from the rotation matrix
	var speed = 0.05;
	var forward = vec3.create();
	var right = vec3.create();
	var up = vec3.create();
	vec3.set(forward, 0, 0, -speed);
	vec3.set(right, speed, 0, 0);
	vec3.set(up, 0, speed, 0);
	if (scene.CameraType == CameraType.FLY)
	{
		vec3.transformMat4(forward, forward, rotation_matrix);
		vec3.transformMat4(right, right, rotation_matrix);
	}

	// Move the camera based on what the user presses
	if (input.KeyState[Keys.W])
		vec3.add(scene.CameraTransform.Position, scene.CameraTransform.Position, forward);
	if (input.KeyState[Keys.S])
		vec3.sub(scene.CameraTransform.Position, scene.CameraTransform.Position, forward);
	if (input.KeyState[Keys.A])
		vec3.sub(scene.CameraTransform.Position, scene.CameraTransform.Position, right);
	if (input.KeyState[Keys.D])
		vec3.add(scene.CameraTransform.Position, scene.CameraTransform.Position, right);
	if (input.KeyState[Keys.E])
		vec3.add(scene.CameraTransform.Position, scene.CameraTransform.Position, up);
	if (input.KeyState[Keys.Q])
		vec3.sub(scene.CameraTransform.Position, scene.CameraTransform.Position, up);

	scene.DrawObjects();
}


function main(canvas, status_bar, overlay)
{
	// Resize the width of the canvas to that of its parent
	canvas.width = canvas.parentNode.offsetWidth;

	// Initialise and exit on error
	var gl = InitWebGL(canvas, status_bar);
	if (!gl)
		return null;
	var input = new Input(overlay);

	// Initialise the window with red backdrop
	gl.clearColor(1, 0, 0, 1);
	gl.clearDepth(1.0);
	gl.clearStencil(0);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.STENCIL_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.stencilMask(0xFF);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

	// Create default shaders

	var fshader = CreateShader(gl, gl.FRAGMENT_SHADER, `
		#ifdef GL_ES
		precision highp float;
		#endif

		uniform vec3 glColour;

		void main(void)
		{
			gl_FragColor = vec4(glColour, 1);
		}
	`);

	var vshader = CreateShader(gl, gl.VERTEX_SHADER,`
		attribute vec3 glVertex;

		uniform mat4 ObjectToClip;

		varying vec3 ls_Position;

		void main(void)
		{
			ls_Position = glVertex;
			gl_Position = ObjectToClip * vec4(glVertex, 1.0);
		}
	`);

	if (fshader == null || vshader == null)
		return null;

	var scene = new Scene(gl, vshader, fshader, canvas, overlay);

	(function animloop(){
		DrawScene(gl, scene, input);
		window.requestAnimationFrame(animloop);
	})();

	return scene;
}


function InitCodeMirror(code_editor, height_matcher)
{	
	var cm = CodeMirror.fromTextArea(
		code_editor,
		configuration =
		{
			theme: "monokai",
			mode: "javascript",
			indentUnit: 4,
			indentWithTabs: true,
			lineNumbers: false,
			matchBrackets: true,
			gutter: false,
		});

	cm.setSize(null, height_matcher.offsetHeight);
	return cm;
}


function ExecuteCode(cm, scene, status_bar, lsname)
{
	var old_scene_meshes = scene.Meshes;
	scene.Meshes = [ ];

	// Inject scene object into evaluated code
	var vars = { "scene" : scene };

	// Continuously save user's code
	var user_code = cm.getValue();
	if (typeof(localStorage) !== "undefined")
		localStorage[lsname + "_Code"] = user_code;

	// Split the user code into any specified buffers
	var buffer_re = /\/\/@buffer\(([^\)]*)\)/;
	user_code = user_code.split(buffer_re);

	// Inject named buffers into evaluated code
	for (var i = 1; i < user_code.length; i += 2)
	{
		var buffer_name = user_code[i];
		var buffer = user_code[i + 1];
		vars[buffer_name] = buffer;
	}

	// The first unnamed buffer is the one to the evaluate as javascript
	var eval_code = "with (vars) { " + user_code[0] + "}";

	try
	{
		ClearError(status_bar);
		eval(eval_code);
	}
	catch (e)
	{
		SetError(status_bar, e.message);
		scene.Meshes = old_scene_meshes;
	}
}


SandboxHTML = (function()
{
	function SandboxHTML(textarea, lsname)
	{
		this.Name = lsname;
		
		// Create host HTML
		var div = document.createElement("div");
		var html = `
			<div class="wglsbx-Root">
				<div class="wglsbx-CanvasHost">
					<canvas height="500" tabindex="1"></canvas>
						<div class="wglsbx-Buttons">Control Mode
							<label><input type="radio" name="select3" /><span>Fly</span></label>
							<label><input type="radio" name="select3" checked="true"/><span>Rotate</span></label>
						</div>
					<div class="wglsbx-Status">Status: OK</div>
					<span class="wglsbx-Controls">Rotate: LMB, Move: WSAD</span>
					<div class="wglsbx-Overlay" tabindex="0"></div>
				</div>

				<div class="wglsbx-CodeEditor">
				</div>
			</div>
		`;

		// Set name of the radio button set
		var radio_set = lsname + "Radio";
		html = html.replace("select3", radio_set);
		html = html.replace("select3", radio_set);
		div.innerHTML = html;

		// Swap textarea with created div
		textarea.parentNode.insertBefore(div, textarea);
		textarea.parentNode.removeChild(textarea);

		// Record for future use
		var root = div.children[0];
		this.Host = root.children[0];
		this.Canvas = this.Host.children[0];
		var buttons = this.Host.children[1];
		this.FlyButton = buttons.children[0].children[0];
		this.RotateButton = buttons.children[1].children[0];
		this.Status = this.Host.children[2];
		this.Overlay = this.Host.children[4];
		this.Editor = root.children[1];

		// Put textarea in the editor div
		this.Editor.appendChild(textarea);
	}

	SandboxHTML.prototype.OnControlModeChange = function(on_change)
	{
		// Map button check state to camera type
		var self = this;
		var GetCameraType = function()
		{
			return self.FlyButton.checked ? CameraType.FLY : CameraType.ROTATE;
		}

		// Setup events to pass new camera type changes
		this.FlyButton.onchange = function() { on_change(GetCameraType()); };
		this.RotateButton.onchange = function() { on_change(GetCameraType()); };
	}	

	return SandboxHTML;
})();


function SetupLiveEditEnvironment(textarea, lsname, loadls, hidecode)
{
	var html = new SandboxHTML(textarea, lsname);

	// Start the code editor first to give the user something to look at in case scene
	// creation fails
	var cm = InitCodeMirror(html.Editor, html.Host);

	// Load existing code from user's local store
	if (loadls && typeof(Storage) !== "undefined")
	{
		var store = localStorage[lsname + "_Code"];
		if (store)
			cm.setValue(store);
	}
	else
	{
		cm.setValue(textarea.value);
	}

	if (hidecode)
	{
		// Remove editor from layout and center the canvas
		cm.getWrapperElement().style.display = "none";
		html.Host.style.float = "none";
		html.Host.style.margin = "0 auto";

		// Also no need for error messages, assuming the code is good
		html.Status.style.display = "none";
	}

	// Oh, GOD... wait for the browser layout engine to complete after dynamic creation
	// of the sandbox, before creating the WebGL context that resizes itself to fit within
	window.setTimeout(function(){

		// Create the WebGL context/scene
		var scene = main(html.Canvas, html.Status, html.Overlay);
		if (scene == null)
			return;

		// Change scene camera type on radio button select
		html.OnControlModeChange(function(camera_type)
		{
			scene.CameraType = camera_type;
			scene.CameraTransform = camera_type == CameraType.FLY ? scene.FlyCameraTransform : scene.RotateCameraTransform;
		});

		// Perform the first code execution run
		ExecuteCode(cm, scene, html.Status, lsname);
		var last_code_hash = HashString(cm.getValue());

		// Check for code changes periodically
		setInterval(function()
		{
			var code_hash = HashString(cm.getValue());
			if (code_hash != last_code_hash)
			{
				last_code_hash = code_hash;
				ExecuteCode(cm, scene, html.Status, lsname);
			}
		}, 1000);

	}, 1);
}

return SetupLiveEditEnvironment;

})();
