+++
date = "2011-09-25T23:34:13+01:00"
draft = false
title = "Reflection in C++, Part 1: Introduction"
tags = [ "c++", "reflection" ]
+++

If there was one job I'd love to do other than writing games it'd be writing compilers. This probably explains my obsession with the subject of reflection; a topic I've been hammering away at for almost 10 years now. Having written a few compilers in the past, it became glaringly obvious to me that reflection would be quite simple to add to C++ -- if you're willing to place some limits on it -- and that the language has suffered from its absence.

Adding reflection to C++ via a library or other means can be a simple task, a very hard task, or a down-right impossible task. You can't reflect all aspects of your C++ program and it's highly unlikely that you will ever want to.

This is the start of a series of tutorials on reflection from the point of view of a game programmer. As a first post it is very high-level with the hope that it will provide you with some key reasons why you might want to add reflective features to your game engine.

Subsequent posts will provide in-depth case studies of methods I've developed in the past that are either out there in shipped games, buried in code bases never to be seen again or the result of frenzied late night coding sessions:

* I'll cover a very simple method of reflection that can be very powerful, developed in my spare time as [Reflectabit](https://bitbucket.org/dwilliamson/reflectabit), with a similar implementation written for Splinter Cell: Conviction. The main selling points of the implementation are the ease with which you can replicate anything over a network connection and the extra bonus of being able to live-edit your C++ code while the game is running.
* This will be followed by an approach that required the development of an IDL compiler and some crazy template programming for performing binding to arbitrary programming languages. Even though it worked on a PSP, it wasn't the ideal method of achieving a solution for that platform and a subset of its implementation could prove a good match for others out there.
* Another spare time project of mine I'll cover is something I informally call [Reflectalot](https://bitbucket.org/dwilliamson/rfl). It works by scanning a PDB file and is surprisingly thorough at providing you with most of the information you need, albeit not really cross-platform (PC & Xbox 360 only). One of its cunning little features is its ability to provide you with a constant-time `typeof` operator.
* Finally I'll cover my latest development, [clReflect](https://github.com/Celtoys/clReflect), that uses the [clang C++ frontend](http://clang.llvm.org/) to build a reflection database. This to me is as close to ideal as I'm going to get for C++ on Windows, however it can be taken to its logical conclusion on other platforms such as MacOS or Linux where the LLVM backend is more stable. Please checkout its webpage because I'd really love some help developing it further!


#### What is Reflection?


A reflection API is a very basic, powerful tool that every game studio should have at their disposal. It normally contains some or all of the following features:

* A database of types and their inheritance relationship with each other.
* A means of creating objects of a specific type by name.
* A list of data member descriptions for each type, with name/type/offset tuples.
* A database of enumeration types and their associated key/value pairs.
* A database of functions/methods with their return types and parameter lists.
* A means of calling functions/methods by name at runtime with an arbtrarily constructed parameter list.
* A database of properties represented as Get/Set method pairs that externally look like a named value.
* A database of attributes that can be attached to any of the above, describing how they should be used.

Each language has varying levels of support for reflection, while C++ has RTTI. You can do various things with RTTI but it's an incredibly limited system that only gives you:

* The ability to discover an object's type at runtime through the `typeid` operator.
* A `typeid` operator that can also be applied to types themselves.
* A type's name, its hash code and some comparison functions.
* Runtime downcasting and similar operations through `dynamic_cast`.

This is not nearly enough! RTTI also has varying levels of support between compilers and type names are implementation specific.

So why would you want reflection? Perhaps it's best to list a few things that it can enable:

* Serialisation of any game type.
* Transparent implementations of various backend data formats with one point of serialisation for any given format.
* Versionable serialisation of any data.
* Inspect game state of any object at runtime for debugging.
* Dependency tracking with the pointer graph (ever wanted to know what objects are dependent on another before deleting?).
* Reloadable resource (mesh, texture, script, etc) reference updating.
* Automatically populate and describe user interfaces for editing tools.
* Binding to arbitrary programming languages (Lua, C#, Python, etc.) through minimal translation layers.
* Network communication/replication through serialisation and RPC.
* Memory mapping of data formats with post-load pointer patching.
* Live C++ code editing.
* Garbage collection or defragmentable memory heaps (useful on systems where the GPU uses physical addressing).

You can of course build individual systems for each of these but they all share the same need to register type data and access it offline or at runtime. Using reflection for these systems can either make everything easier to understand and maintain or obfuscate intent and lead to a brittle code base. As such, a clean and simple reflection API is absolutely vital if you intend to adopt one.

Generating a reflection database can be done in any number of different ways with C++, including:

* Using macros to simultaneously annotate your code and generate registration calls.
* Using templates and meta-programming techniques to achieve the same goal.
* Using a hybrid of the above or even doing it non-intrusively. Collectively these are runtime databases with no offline representation.
* Using an IDL/DDL compiler to generate cpp/h files containing C++ equivalents and registration code. This can also generate an offline representation of your database that can be used in tools.
* Using an existing language that already has reflection to describe your data/interfaces to achieve the same as the previous method (C# is a good candidate for this).
* Performing a pre/post process on your C++ code using a custom parser that picks up interesting information.
* Inspecting debug information emitted by the compiler.

There are many tradeoffs with each technique and covering each is beyond the scope of these posts. However, the use-cases should be broad enough to show how varied implementations can be.


#### Basic C++ Reflection API

To introduce the above concepts we'll need a quick API we can talk about:

~~~cpp
struct Name
{
	int hash;
	string text;
};
struct Primitive
{
	Name name;
};
struct Type : public Primitive
{
	int size;
};
struct EnumConstant : public Primitive
{
	int value;
}
struct Enum : public Type
{
	EnumConstant constants[];
};
struct Field : public Primitive
{
	Type type;
	int offset;
};
struct Function : public Primitive
{
	Field return_parameter;
	Field parameters[];
};
struct Class : public Type
{
	Field fields[];
	Function functions[];
};
struct Namespace : public Primitive
{
	Enum enums[];
	Class classes[];
	Function functions[];
};
~~~

The base type for any entry in the reflection database is a **Primitive** and will be used below to describe any such entry.


#### Serialisation


The cross-over between serialisation and reflection APIs is quite large and subtle. When you have game objects that you want to load and save from disk, a natural response is to develop a dedicated serialisation API that reads and writes data from within your game types. Reflection can be considered a generalisation of such a serialisation API by presenting a runtime description of all your types and their memory layout. This allows you to write serialisation code separate from your types that can be adapted to suit multiple file formats.

Let's start with a very basic set of game types:

~~~cpp
struct Vector
{
	float x, y, z;
};

struct PhysicsComponent
{
	Vector position;
	Vector velocity;
	Vector acceleration;
};
	
struct GameObject : public Object
{
	PhysicsComponent physics;
};
~~~

The reflection database can tell you:

* `Vector` has 3 floating point data members at offsets 0, 4 and 8.
* `PhysicsComponent` has 3 data members of type `Vector` at offsets 0, 12 and 24.
* `GameObject` has one `PhysicsComponent` at offset 0.

`Object` is a type introduced by the reflection API that all objects must inherit from if they intend to be the root of any serialisation requests. In the code above `Vector` and `PhysicsComponent` do not inherit from `Object`, representing any of your lightweight game types. This means that you can only serialise objects of type `GameObject` - however, as long as the reflection database contains a description of the `Vector/PhysicsObject` types, they can be serialised as part of any objects that contain them. This should become apparent when we introduce what `Object` actually looks like:

~~~cpp
struct Object
{
	Type* type;
};
~~~

So far that's all we need. `Object` simply stores a pointer to the reflection database's description of whatever type that object is. Some psuedo-code for a save function would be:

~~~cpp
void SaveObject(Object* object)
{
	// Types that inherit from Object already know their type so can call
	// the overloaded SaveObject directly
	SaveObject(object, object->type);
}

void SaveObject(char* data, Type* type)
{
	// Using the description of the type, iterate over all fields in
	// the object
	for (Field* field in type->fields)
	{
		// Each field knows its offset so add that to the base address of the
		// object being saved to get at the individual field data
		char* field_data = data + field->offset;

		// If the field type is a known built-in type then we're at leaf nodes of
		// our object field hierarchies. These can be saved with explicit save
		// functions that know their type. If not, then we need to further
		// recurse until we reach a leaf node.
		Type* field_type = field->type;
		if (field_type is builtin)
			SaveBuiltin(field_data, field_type);
		else
			SaveObject(field_data, field_type);
	}
}

void SaveBuiltin(char* data, Type* type)
{
	switch (type)
	{
		case (char): WriteChar(data);
		case (short): WriteShort(data);
		case (int): WriteInt(data);
		case (float): WriteFloat(data);
		// ... etc ...
	}
}
~~~

Whether your file format is text XML or binary, the algorithm is the same. The difference is in how you write your known built-in types and how you annotate your output data along the way (e.g. text tags for XML). A nice side-effect of writing your serialisation this way is that for a given file format, your serialisation code is written in one place and can handle any object that can be described by your reflection API - you just have different files for each format implementation.


#### Containers


Game objects are more complicated than those specified above and will have containers. This is an umbrella term for any of these:

* C-style Arrays
* Vectors
* Linked Lists
* Sets
* Key/Value Maps and Hash Maps

For the moment if we assume that our primary goal is to make these serialisable, a simple means of doing so is to extend `SaveObject`:

~~~cpp
void SaveObject(char* data, Type* type)
{
	// ... start of function ...
	
		if (field_type is builtin)
			SaveBuiltin(field_data, field_type);
		else if (field_type is container)
			SaveContainer(field_data, field_type);
		else
			SaveObject(field_data, field_type);
	
	// ... rest of function ...
}

void SaveContainer(char* data, Type* type)
{
	switch (type)
	{
		case (vector): WriteVector(data, type);
		case (list): WriteList(data, type);
		// ... etc ...
	}
}

void SaveVector(char* data, Type* type)
{
	// Cast the data to your vector type
	vector& vec = data cast as vector;
	
	Type* stored_type = type->container_value_type;
	
	for (int i in vec.count)
	{
		char* value_data = data + i * stored_type->size;
		SaveObject(value_data, stored_type);
	}
}
~~~

The first problem we come up against is that, taking `SaveVector` as an example, the type of the vector changes based on the data it stores. So, `std::vector<int>` is a different type to `std::vector<short>` and can't be cast at runtime. There are two ways of dealing with this that will be covered in more detail later in the use-case studies. They are:

* The reflection API is entirely runtime-based and when you register a field that is a container, code gets generated using templates that will be used to serialise when needed. This has the benefit that any container becomes easily serialisable without you having to know the memory layout of the container type itself. It has the drawback that it can generate quite a substantial amount of code that can have a negative impact on your memory budget.
* If you can rely on knowing the memory layout of your container independent of its type, you can use that to iterate over all elements using the type information stored in the reflection database, as above. This has the benefit that there is only one section of your code that is used to serialise all containers of that type. It has the drawback that you may not want to rely on knowing the internal layout of your container because it's not part of an API that you own/control, e.g. STL.

The second problem you encounter is that if you have N file formats and M types of container, you're going to have to write M*N functions that handle all your serialisation possibilities. Later discussion covers how to use the reflection database for other purposes, such as walking a pointer graph, and in such cases you'd also have to write specific implementations for each container type.

Obviously that won't do and you can add a layer of indirection to get around this. The way I deal with this is by introducing the container interface to report basic information about a container, such as its entry count, and read/write iterator interfaces for reading and modifying the containers:

~~~cpp
interface IContainer
{
	Type* GetKeyType() const;
	Type* GetValueType() const;
	
	ReadIterator GetReadIterator();
	WriteIterator GetWriteIterator();
};

interface IReadIterator
{
	char* GetKey() const;
	char* GetValue() const;
	int GetCount() const;
	
	void MoveNext();
	bool IsValid();
};

interface IWriteIterator
{
	void SetKey(char* data);
	void SetValue(char* data);
	
	void MoveNext();
	bool IsValid();
};
~~~

If you want to skip ahead, [Reflectabit](https://bitbucket.org/dwilliamson/reflectabit/src/tip/inc/rflb/Container.h) contains a very good example of this.

All container types you support implement these interfaces. Notice that they account for both the key and value of an item in a container, which can be safely ignored for those containers that don't conceptually have keys. Use is then a simple case of:

~~~cpp
void SaveContainer(char* data, Type* type)
{
	ContainerInterface* container = type->GetContainerInterface(data);
	Type* key_type = container->GetKeyType();
	Type* value_type = container->GetValueType();
	
	Serialise iterator->GetCount();
	
	WriteIterator* iterator = container->GetWriteIterator();
	while (iterator->IsValid())
	{
		if (key_type)
			SaveObject(iterator->GetKey(), key_type);
		
		SaveObject(iterator->GetValue(), value_type);
		
		iterator->Next();
	}
}
~~~

Like the serialisation code that we started with, this algorithm is independent of file format and only differs in how the data is finally written. This also requires you to write only one container save per file format, cleanly solving the implementation explosion.


#### Pointers and the Object Database


Serialising pointers can be a tricky subject and any grizzled console programmer will tell you that a good way to handle the problem is to not serialise them at all! If you can get away with using indices and handles you may find them more comfortable than pointers. With a reflection API and object database, however, serialising pointers is remarkably easy. Not only that, it opens up a whole host of possibilities for future use.

To start you need some means of creating objects from a central source and assigning them a unique ID, so let's redefine `Object` and introduce the object database:

~~~cpp
struct Name
{
	u32 id;
	const char* text;
};

struct Object
{
	Name name;
	Type* type;
};

class ObjectDatabase
{
	Object* CreateObject(const char* type_name);
};
~~~

Here, the `Name` type represents the full name of your object, assigned offline by your tools/editor or generated at runtime. It contains a pointer to the text of the name that can be used for debugging and a unique ID that maps to that name - usually a hash of the name. The text can be removed in your release builds or preferrably, not stored at all: it's pretty simple to create a Visual Studio debugger plugin that can map the ID to a locally stored text database or write network logging tools that only require the ID to print the name. The important point is that your means of generating the ID from the name must be consistent and there must be no collisions.

Given such properties, serialising pointers is a straight-forward case of serialising their ID in place of their pointer:

~~~cpp
if (field_type is pointer)
{
	Object* object = (Object*)field_data;
	Serialise object->hash as u32
}
else if (field_type is builtin) ...
~~~

Generally you will need a top-level collection of all objects in a level, package or whatever abstraction you choose. The classic example of this is the [Unreal Package](http://udn.epicgames.com/Three/UnrealPackages.html). When loading these IDs, you generally won't create them on-demand, but assume they exist and look them up/point to them. For this reason you need to be careful about loading order.

Several solutions I've used in the past are:

* If the referenced object doesn't exist, create an uninitialised proxy object for it.
* Use scoped tree-referencing where pointers can only go in one direction.
* The package being loaded contains a list of packages it depends upon that need to be loaded first.


#### Custom loading functions


Game objects can be even more complicated than this - sometimes you have fields which can't directly be serialised to disk. A good example of this is a D3D vertex buffer, which is represented as a D3D resource interface pointer. Other times there are types which may not be reflection-registered due to their complexity that you still want to save - `std::string` is a nice example of this.
 
With each type or field you can associate a means of loading and saving data of that type via a function pointer. The serialisation code first checks to see if the field type has an associated set of load/save functions before trying to serialise another way. It can be a little more complicated than that if you're worried about performance and support for multiple file formats; take the simplest example of this:

~~~cpp
// Serialisation code for the XML file format
if (SaveFunc f = field_type->save_funcs.find(FORMAT_XML))
{
	f(field_data, field_type);
}
~~~

Before you get to checking what other properties the field may have, you're doing some form of map lookup.

The simplest/fastest way of doing this I've found is by assigning your file format types indexed enums and having an array of function pointers inside your type/field:

~~~cpp
enum Format
{
	FORMAT_BINARY,
	FORMAT_TEXT_XML,
	FORMAT_BINARY_XML,
	FORMAT_COUNT
};

struct Type
{
	SaveFunc save_funcs[FORMAT_COUNT];
	LoadFunc load_funcs[FORMAT_COUNT];
};
~~~

Serialisation becomes quick and simple but there is a loose-coupling of concepts between reflection API and serialisation code which you may not like. A happy medium of the two is storing a sorted, dynamic array in the type that can be binary searched - the general case would be an empty array that is quickly skipped.

The serialisation code with custom save array lookup now looks like this:

~~~cpp
void SaveObject(char* data, Type* type)
{
	// Using the description of the type, iterate over all fields in
	// the object
	for (Field* field in type->fields)
	{
		// Each field knows its offset so add that to the base address of the
		// object being saved to get at the individual field data
		char* field_data = data + field->offset;

		// Branch on field type
		Type* field_type = field->type;
		if (field_type is pointer)
			Serialise ((Object*)field_data)->hash as u32
		else if (SaveFunc f = field_type->save_funcs[FORMAT_XML])
			f(field_data, field_type);
		else if (field_type is builtin)
			SaveBuiltin(field_data, field_type);
		else if (field_type is container)
			SaveContainer(field_data, field_type);
		else
			SaveObject(field_data, field_type);
	}
}
~~~

It's worth mentioning that another means of achieving this is to have a single Load/Save function per object that handles the serialisation of all fields that are too complicated to reflect in one place. Unreal Engine (UE) is a good example of this and it's one of the main reasons I prefer the above solution. There are no marked boundaries between serialised fields so it's very easy to damage an entire object by messing up one field - you can't temporarily skip it and keep everybody working while you solve the problem at hand. It gets more unwieldy when you get into versioning, which is covered below.


#### Versioned file formats


So far we haven't taken a look at any loading code. Some pseudo-code for loading anything saved with the features we've covered above could look like this:

~~~cpp
void LoadObject(char* data, const Type* type)
{
	for (Field* field in type->fields)
	{
		char* field_data = data + field->offset;
		Type* field_type = field->type;
		
		if (field_type is pointer)
			// Load u32 hash, lookup in Object Database, point to it (or create, or proxy object, impl defined...)
		else if (LoadFunc f = field_type->load_funcs[FORMAT_XML])
			f(data, field_type);
		else if (field_type is container)
			LoadContainer(field_data, field_type);
		else if (field_type is builtin)
			LoadBuiltin(field_data, field_type);
		else
			LoadObject(field_data, field_type);
	}
}
~~~

This code expects the data to be saved in the order the fields are specified in the type. If you add or remove fields or change the implementation of your custom loading function then catastrophe awaits. A versionable file format is one which can adapt to these changes gracefully.

Versionable file formats can be an incredibly important tool for development files in game asset pipelines. A good example here would be a mesh file format, as loaded by your game:

* Edit the mesh in your DCC.
* Export the mesh to an intermediate file format - this is custom or 3rd party (e.g. COLLADA, FBX or XSI).
* A custom tool "compiles" the mesh to its game-loadable file (per platform).
* Editor loads the output to use as level edit placement.
* Game loads the output.

Discussion of the merits of different build and development strategies goes far beyond the scope of this post, considering the variety of approaches developers take. However, if you're using a build system that caches the compiled mesh contents so that other developers don't have to build them locally to run the game, you'll need to have a system in place to handle changes to the formats of those cached files.

A common approach taken in many studios, including some I've worked at is to store a version number at the start of each mesh file and refuse to load the file (or assert) if there's a version mismatch. When a programmer wants to change the file format, they do the following:

* Make the change locally on their machine and iterate on a small subset of the assets.
* Kick off a process that recompiles every mesh in the game. This can be overnight on your machine or offloaded to an worker machine and distributed in some way.
* Submit new compilation tools, game and compiled assets.
* Content creators sync to new tools and new assets - potentially gigabytes of data.

On one project it was not unknown for a complete rebuild of all textures to take up to a week. This put the programmer offline for a considerable amount of time, requiring multiple client-specs to maintain productivity. It completely killed any enthusiasm to change the file formats. Your mileage may vary but I've found that the ease at which I can optimise a game is greatly influenced by the ease at which I can modify the format of the files it loads.

If your file format is amenable to change, you can do the following:

* Make the change locally and iterate on a small subset of the assets.
* You can integrate these assets into larger levels with older assets during testing.
* Submit new compilation tools and game.
* Content creators get latest and can still play/edit the game.
* Any assets created or modified use the latest file format.
* Programmer schedules an offline build process to gradually go through all cached meshes and convert them to the new format.
* Content creators slowly sync over time to the updated assets.

This forms the backbone of UE-based development and scales gracefully to 150-200 man teams with outsourced developers added on top. It's also how we built the Splinter Cell: Conviction engine, allowing us to rewrite the renderer on the main branch while around 50-80 content creators continued to work with daily tool/game updates.

I'm straying a little too far from the point of this post but this is a worthy discussion to have. The reality is, each developer views the issue differently and it's possible to take any of the above solutions and create an environment in which it works wonderfully well or is a constant production risk.

So, back to the point! If your output format is XML, you can simply change your loading code to:

~~~cpp
void LoadObject(char* data, const Type* type)
{
	for (string tag in xml_nodes)
	{
		// Skip any fields that have been removed
		Field* field = type->find_field(tag);
		if (field == 0)
			continue;

		// Normal loading
		char* field_data = data + field->offset;
		Type* field_type = field->type;
		if (field_type is pointer)
			// Load u32 hash, lookup in Object Database, point to/create it
		else if (LoadFunc f = field_type->load_funcs[FORMAT_XML])
			f(data, field_type);
		else if (field_type is builtin)
			LoadBuiltin(field_data, field_type);
		else if (field_type is container)
			LoadContainer(field_data, field_type);
		else
			LoadObject(field_data, field_type);
	}
	
	// Any added fields in the type won't be present in the data so are
	// naturally handled if you provide them with a default value
}
~~~

If your output format is binary you can use a solution similar to [IFF files](http://www.ibm.com/developerworks/power/library/pa-spec16/): each field is prefixed with a chunk descriptor that specifies a tag ID and chunk size. In our case, the tag ID can be the hash of the field name:

~~~cpp
void LoadObject(char* data, const Type* type)
{
	int nb_fields = read from file;
	
	for (i in nb_fields)
	{
		// Read the chunk header
		u32 field_hash = read from file;
		u32 data_size = read from file;
		
		// Skip any fields that have been removed
		Field* field = type->find_field(field_hash);
		if (field == 0)
		{
			// seek from current position over the data_size
			continue;
		}
		
		// Normal loading
		char* field_data = data + field->offset;
		Type* field_type = field->type;
		// ...
		
		// You can insert an extra check here to verify that the loading code has
		// consumed the number of bytes equal to data_size. Very useful for tracking
		// errors in custom loading functions.
	}
}
~~~

This has two issues you need to solve:

* If somebody loads a new file version with an older version of your editor, it will discard data when resaving. One way of solving this is to store the data of any skipped fields in a dictionary assigned to that object that gets saved later. A simpler way is to force everybody to update to any new tools versions!
* If data for a newly added field is not present in the file, a nice default value needs to come from somewhere. An easy solution is to initialise your default value in the object constructor. The downside to this is that the default value is not visible to external tools and you need to recompile source each time you change a default value. Another approach would be to specify the default value as some reflection attribute that gets saved offline. You would need to change the code above to then manually assign these defaults to any missing fields.

Custom load/save functions need special attention with respect to versioning. As mentioned above, UE has a [custom Serialize function per object](https://docs.unrealengine.com/latest/INT/API/Runtime/CoreUObject/UObject/UObject/Serialize/index.html), within which multiple version checks are made to see what needs to be serialised. This can get very complicated to manage and is easy to break.

When you have the ability to associate custom load/save functions per type or per field, this becomes easier to manage. If you serialise version numbers with each function then the job of deciding what's valid and skipping invalid chunks is handled automatically for you, leading to more maintainable and fault tolerant code.

Both methods can suffer from lack of old version pruning. When we started Splinter Cell: Conviction, there was still loading code for the mesh format in the original Splinter Cell. Nobody knew whether this worked as it hadn't been tested in years. Updating the code was fraught with problems and a reboot was required.


#### Enumerations


Enumerations can quite easily be serialised as integers but this is quite brittle. If a programmer changes the order of enumerations, changes their value or adds/removes any, all existing data that uses that enum type will likely be invalidated. I have worked on projects that would require rebuilding the entire asset database if you were ever bold enough to try such a move!

A very simple way to avoid this problem is to serialise enumerations as the hash of their name:

~~~cpp
void SaveEnum(char* data, Type* type)
{
	// Cast the type to an enum and retrieve the value
	Enum* enum_type = type->AsEnum();
	int enum_value = *(int*)data;

	// Lookup the constant and save its hash
	EnumConstant* constant = enum_type->find_constant(enum_value);
	WriteU32(constant->name.hash);
}

void LoadEnum(char* data, Type* type)
{
	// Cast the type to an enum and read the constant hash
	Enum* enum_type = type->AsEnum();
	int hash = ReadU32();
	
	// Lookup the constant and assign the value
	EnumConstant* constant = enum_type->find_constant(hash);
	*(int*)data = constant->value;
}
~~~

You will also have to account for data that stores old enum values, typically handled by leaving the destination untouched and initialised at its default value.


#### Performance: Baked serialisation functions & PODs


This may all seem a little slow but the reality is you are likely to be I/O bound; even on hard-drives none of this code factors negatively in the performance.

However, it can be given a little speed boost with a technique that you may find easier to read/maintain: give each field a custom serialisation function. Instead of the inner loop of `SaveObject` branching, ahead of time you can figure out what the result will be and record it for that field:

~~~cpp
void BakeSerialisationFunctions(Field* field, Format format)
{
	// Don't bake anything for transient fields
	if ("transient" in field->attributes)
		return;

	// Bake the save function based on the type
	if (field_type is pointer)
		field->save_funcs[FORMAT_XML] = SavePointer;
	else if (field_type->save_funcs[FORMAT_XML])
		field->save_funcs[FORMAT_XML] = field_type->save_funcs[FORMAT_XML];
	else if (field_type is builtin)
		field->save_funcs[FORMAT_XML] = SaveBuiltin;		
	else if (field_type is enum)
		field->save_funcs[FORMAT_XML] = SaveEnum
	else if (field_type is container)
		field->save_funcs[FORMAT_XML] = SaveContainer;
	else
		field->save_funcs[FORMAT_XML] = SaveObject;
}

void SaveObject(char* data, Type* type)
{
	// Call the save for each field
	for (Field* field in type->fields)
	{
		char* field_data = data + field->offset;
		Type* field_type = field->type;
		field->save_funcs[FORMAT_XML](field_data, field_type);
	}
}
~~~

Furthermore, if your reflection API deems that an object is of a POD type, you don't have to recurse into the children and can instead write a binary blob for the entire object (un-versioned, binary only).


#### Field offsets and inheritance


The basic implementation of a `Class` type will store only the fields that were declared within the class. Field layout is ABI-specific and you will need a database per compiler/platform when using field offsets. Access to fields of its base class requires following the base class pointer in `Class`:

~~~cpp
void SaveObject(char* data, Type* type)
{
	// ... end of the function ...
	
	// Recurse into base types
	if (type is class && type->base_class)
		SaveObject(data, type);
}
~~~

This has some subtle side-effects. If your class contains virtual methods then it's up to the compiler where it stores the virtual function table pointer. Typically this has no effect on the validity of recording field offsets that are used at runtime but there are some simple cases where it breaks. Take this piece of code:

~~~cpp
struct PodBase { int x; };
struct NonPodDerived : public PodBase { virtual void f(); };
NonPodDerived obj;
NonPodDerived* a = &obj;
PodBase* b = a;
~~~

The addresses of `a` and `b` will be different because `NonPodDerived` needs to store an extra virtual function table pointer. This means that the address of `PodBase::x` will be different to `NonPodDerived::x`!

If you want to use multiple inheritance, things get a little trickier:

~~~cpp
struct B0 { int x; };
struct B1 { int y; };
struct C : public B0, public B1 { int z; };
~~~

The field offsets for both `x` & `y` in their class descriptions will be 0. When serialising `B0` and `B1` on their own this will be fine, but when serialising `C`, both `x` & `y` can't live at offset 0! The compiler may layout `C` like this:

	x: 0
	y: 4
	z: 8

Serialising this kind of object using the class descriptions of `C`, `B0` and `B1` will not work. This simple case can be solved by calculating the offsets of `x` & `y` when contained in `C` and storing them in the class description of `C` itself. No longer will your serialisation code walk up the inheritance hierarchy finding members, and given that reflection databases are usually quite small, you may actually find this kind of setup preferrable. It will also fix the first issue.

But what if `B0` and `B1` themselves inherit from the same base class? This is the dastardly diamond inheritance issue:

~~~cpp
struct A { int w; }
struct B0 : public A { int x; };
struct B1 : public A { int y; };
struct C : public B0, public B1 { int z; }
~~~

In this case `C` will contain two copies of `A`, each with different offsets for their own `w`. There's really no clean solution to this in a reflection API unless you add more complexity. One way to force the compiler to only embed one copy of `A` in `C` is to use virtual inheritance:

~~~cpp
struct A { int w; }
struct B0 : virtual public A { int x; };
struct B1 : virtual public A { int y; };
struct C: public B0, public B1 { int z; };
~~~

We're into highly implementation specific territory here but the compiler might offset like this:

	vptr B0: 0
	x: 4
	vptr B1: 8
	y: 12
	z: 16
	w: 20

Notice that `w` is right at the end and there's only one copy. There's also a couple of virtual table pointers in `C` that help the compiler cast between the various classes at runtime. At first sight, it appears that using the initial multiple inheritance solution might work here, however the representation of a member offset for non-POD types is implementation defined and not guaranteed to work on any compiler. Indeed, the following code crashes at runtime in MSVC2005:

~~~cpp
struct VirtualBase { };
struct Derived : virtual public VirtualBase { int x; };
int offset = offsetof(Derived, x);
~~~

You will hit this issue if you decide to allow multiple inheritance of root serialisation types as they all need to inherit from `Object`.

There are a few ways of recording the offset of a field, including:

* With runtime, templated registration, you can create "visitor functions" that wrap access to the field. This is by far the most portable/standards-compliant way of doing this but you're adding complexity to your API & runtime, increasing compile times and generated code size.
* At runtime you can use the C++ `offsetof` macro. This is standards-compliant for [POD types](http://www.fnal.gov/docs/working-groups/fpcltf/Pkg/ISOcxx/doc/POD.html). It's practically compliant for a variety of non-POD configurations for the platforms game developers use but will break down with pure virtual inheritance.
* Offline, you can use a layout generator that knows the target ABI and can calculate the field offsets for you. A good example of this is the one that ships as part of clang: [RecordLayoutBuilder.cpp](http://clang.llvm.org/doxygen/RecordLayoutBuilder_8cpp_source.html).
* Get your compiler to report field offsets after a compile step.

In later posts I'll explain how `offsetof` works and how you can work-around its limitations with pure virtual inheritance. However, it's hairy territory and I'd advise avoiding the problem altogether - personal experience has shown that the added complexity required to deal with such cases does not justify the limited use it sees.

It's worth reading [Memory Layout for Multiple and Virtual Inheritance](http://www.phpcompiler.org/articles/virtualinheritance.html) to get more background information on this problem.


#### Attributes


Attributes are a means of annotating your primitives, adding extra data that can be used to control how your program performs at runtime. [C++11 attributes](http://en.cppreference.com/w/cpp/language/attributes) are not what I'm referring to here as they don't allow you to define your own attributes/values. [C# attributes](http://msdn.microsoft.com/en-us/library/aa287992.aspx) are closer but a little too powerful/complicated.

A simpler attribute system would allow:

* Flags: Named flags that represent a boolean state. A classic example is `transient`, which allows you to mark fields which you don't want to serialise.
* Values: These are name/value pairs, such as `min_value`, `max_value`, `default_value`, that can be used to drive user interface widgets. Integer or floating point value types can be used.
* Strings: These are name/value pairs, such as `description` and `group`, that allow you to attach descriptive/grouping data to a primitive for user interfaces.
* Functions: Name/function name pairs that allow you to more conveniently specify custom load/save functions (e.g. `load=FunctionName`).

Later posts will describe ways in which you can annotate primitives and retrieve them at runtime. There are, as you would guess, many tradeoffs with each approach.


#### Network Serialisation and Visualisation of Game State


It's probably obvious by now how this can be achieved: use serialisation to a byte buffer that is optionally compressed and send that to your endpoint - most likely binary and versionable. With the addition of an attribute that describes network transient fields, this allows you to make some very powerful editing tools.

The main class of tool is an editor that connects to a live game, edits an intermediate data representation and broadcasts changes to a live game. There are many benefits to this approach:

* You get live updates of any changes on PC or console.
* Design is multi-threaded due to the nature of network communication, making for some graceful UI tools.
* You can iterate on your tool code without bringing the live game down. If the tool crashes, it doesn't bring down the game.
* If your game gets into a state that is deemed incorrect, you can connect and visually see the state of all your objects.

If you want to write your tool code in C# or embrace the era of the Internets and write in a combination of Javascript, HTML, CSS, etc. you only need to write the equivalent of the above serialisation code in that language to allow editing and communication. Each C++ container type you support will need to map to an equivalent in the tool language.

This is how a stand-alone material editor, realtime PIX debugging tool and post-process editor were developed for Splinter Cell: Conviction, to be discussed in a later post.

This is more than likely not good enough for communicating real-time network updates for game code as you'll want to do things like:

* Use context-specific knowledge to compress data (e.g. movement updates).
* Use smaller situation-specific packet structures to communicate small changes to objects.
* Compress the ID representation of any objects that are referenced by packets.

You can use a reflection API to describe your packet structures and binary serialise them or generate C++ code from the offline representation. If your packet structures end up being PODs then you can write code which performs a memcpy, exchanging any pointers for the unique hash of the object pointed to. However you choose to do it, the basic description of types and their layout that a reflection API can provide you with can give you a good head start.


#### Walking the Object Graph and the UI


With the tools developed above you can visit all data members within an object and perform arbitrary operations, such as printing their value to a console, displaying them in a widget in-game or recording them using some form of programmable logging system.

If you're generating a UI for your tools, you might be best off using an offline description of your types stored in some easily loadable format (e.g. JSON or XML). If none exists then you need to somehow send the runtime database to your tool (something I've achieved in the past by sending the entire database over the network on tool connect). With this you can:

* Use attributes to specify default values, descriptions, field grouping and ranges.
* Use the type of a field to determine what kind of widget to use, inspecting optional attributes to refine the choice.
* Restrict the assignment of object references based on type.
* Automatically populate enumeration list boxes.

When you can walk the object graph you can also record any pointers an object contains: what other objects does it reference? We used this technique in Splinter Cell: Conviction to accelerate deletes in UE. UE used to serialise all objects in a level, discarding everything but pointers when it needed to check for dependencies. This was incredibly slow in levels which contained 10s of thousands of actors - I believe we got delete operations from minutes down to a couple of seconds. More recent versions of UE have made significant performance improvements in this area, however.

On systems where the GPU can only use physical addressing to reference data, runtime defragmentation of specific memory heaps for vertices and textures becomes a very useful technique. Of course, you need a system that informs any referencing assets where the memory has moved to. The ability to inspect pointers and relocate them makes this quite trivial. You can also solve this issue with handles or an extra level of indirection - you may or may not be willing to accept the runtime performance this costs you based on your overall engine design.

Generalising the issue, you can also do controlled [Garbage Collection](http://www.cs.kent.ac.uk/people/staff/rej/gc.html) by following the pointer graph and highlighting orphaned objects. UE achieves the [same goal](http://wiki.beyondunreal.com/Legacy:Garbage_Collection) by serialising all objects, checking for references in a mark and sweep operation.


#### Calling Functions, Script Binding and RPC


You can build a reflection API for your game without needing to worry about adding function call support. By this I mean the ability to do something similar to the following:

~~~cpp
// Retrieve the function by name
Function* function = db.GetFunction("FunctionName");

// Build a set of parameters to pass to the function
ParameterStack params;
params.Add(1);
params.Add("string");

// Call the function and inspect any return value
function->Call(params);
int ret = params.GetReturnValue();
~~~

This is an incredibly useful tool to have at your disposal for binding to scripting languages. A very simple way to bind to a scripting language is to use its API directly and manually register each function you want to expose:

~~~cpp
void NativeFunctionExample(BindLanguageContext* ctx)
{
	// Pop some parameters off the script language stack
	int param0 = ctx->PopInt();
	string param1 = ctx->PopString();

	// ...do some work with the parameters...
	
	// Push a return value result of the work done
	ctx->PushInt(1);
}

void RegisterFunctions(BindLanguageContext* ctx)
{
	ctx->RegisterFunction("NativeFunctionExample", NativeFunctionExample);
}
~~~

This of course means your function can only be called from script. If you want to call it from C++ code as well the classic solution is to instead create wrapper functions and register them:

~~~cpp
int NativeFunctionExample(int param0, string param1)
{
	// ...do some work with the parameters...
}

void NativeFunctionExample_Wrapper(BindLanguageContext* ctx)
{
	int param0 = ctx->PopInt();
	string param1 = ctx->PopString();
	int ret = NativeFunctionExample(param0, param1);
	ctx->PushInt(ret);
}
~~~

Now you can call `NativeFunctionExample` from C++ and register `NativeFunctionExample_Wrapper` with the script environment. Of course this is highly error-prone and downright tedious. It also gets worse when you try to bind to multiple languages, which is why many solutions have been developed to address these shortcomings.

Examples of automated binding approaches include:

* [SWIG](http://www.swig.org/): This scans your C/C++ header files and automatically generates wrapper code for anything you want to bind to other languages.
* [Boost.Python](http://www.boost.org/doc/libs/1_47_0/libs/python/doc/): Uses template meta-programming to generate the required wrappers at compile-time.
* [LuaBind](http://www.rasterbar.com/products/luabind.html): Uses template meta-programming for binding C++ to Lua.
* [Gem (FuBi)](http://scottbilas.com/publications/gem-fubi/): Uses knowledge of the platform ABI and a description of parameters to populate the native stack.

Template meta-programming approaches suffer from increased compile-times and along with code generation, result in larger than necessary executables. However, the approaches are cross-platform. On the other hand, if you have knowledge of the platform ABI you can write one function that takes a function signature and places parameters on the native stack before calling it. This requires highly platform-specific code but is remarkably concise and has a tiny footprint.

In each of these binding libraries, however, you'll find very similar function registration, parameter description and code generation techniques. This typically takes up a large majority of the implementation and can be quite complicated - the amount of code that deals with the specifics of the script language is not that great. If instead you took one of the above techniques and used it to populate an intermediate stack representation, you can write very simple code for each language variant you need to use:

~~~cpp
void MakeParameterStack(ParameterStack& params, BindLanguageContext* ctx)
{
	// Iterate over every value pushed onto the script stack
	for (int i = 0; i < ctx->ParametersOnStack(); i++)
	{
		BindLanguageVal* val = ctx->GetStackRef();
		
		switch (val->type)
		{
			// If required, convert the script value to a native equivalent
			// In the case of ints, floats, etc, nothing may need to be done
			// In the case of object references, you need a means of preserving
			//    the reference in the target language
		}
		
		// Add to the intermediate stack
		params.Add(val);
	}
}

void CallFunctionFromScript(BindLanguageContext* ctx, string function_name)
{
	// Retrieve the function from the reflecton database
	Function* function = db.GetFunction(function_name);
	
	// Build the parameter stack
	ParameterStack params;
	MakeParameterStack(params, ctx);
	
	// Call the native function
	function->Call(params);
}
~~~

The complicated part of the problem is now holed up in the `Call` function and whatever techniques you use to generate the reflection description of your functions. It's comparitively easy to add new languages with this.

If you're uncomfortable with the overhead this introduces then an offline reflection database can be used to generate C++ wrappers for each function you want to call from script. Naturally, this increases the size of your executable but that may be a trade-off you can handle.

I'll be discussing techniques I've used to bind to Lua, C#, Python and my own custom game language in future posts. This will also include coverage of how container binding was handled.

The final piece of the puzzle, RPC, should now be evident. All you need to do is serialise the parameter stack to a byte buffer and send that over the network. Any return values are serialised and returned. The details of how you wait/poll/interrupt on results are all you need to worry about.


#### Live C++ code editing


Edit-and-continue is OK when it works, but what if you had the ability to edit large sections of your C++ code without having to shutdown the game, reload the compiled executable, load your levels, navigate to your testing location and resume what you were doing? What if you could come to work, load up the game and sit there all day **in the game**, coding away until the day ended. Iteration is essential for creating great games and most studios will already have dynamic reloading of ingame assets such as scripts, textures, meshes, sounds or even entire level layouts. Some may even have a live connection between their editor and the game running on the console. C++ programmers are missing the boat!

Before I cover this, there are a number of ways you can minimise the impact of this problem:

* If you find a scripting language which doesn't sacrifice expressiveness, safety and stability, you can swap it in for coding your game in C++. Correct use of scripting languages can allow you to build the majority of your game logic without also sacrificing performance.
* Compile shaders directly to object files that can be dynamically loaded and reloaded by your engine. Irrespective of how you represent shaders (HLSL files, shader graphs, DCC plugins, etc.) this is easy enough to achieve and should be first on your list.
* Try to make your rendering in some way scriptable without affecting performance - Direct3D effect files are a good example of this.
* Have a level editor that allows easy construction of test levels by programmers so that they can create libraries of levels that test specific features in the game for iterating on them. It should be no substitute for testing said features in final game levels before check-in, however.
* Have save games that can be triggered from any point that can save as much of the game state as possible.
* Work on your loading times before it's too late. Long load times will reduce the amount of time you can spend iterating on your work and make the game harder to test within whatever time frame you have allocated.
* Work on the boot times and stability of your game and editors.
* Work on your compile times.

Done all that? Great! It's not good enough, is it? As an engine programmer, the biggest problem I've always had with just having reloadable shaders is that at some point you have to edit your render code. When you start adding scriptability to your rendering pipeline you increase its complexity, make the performance more opaque, and never quite reach the flexibility you need, requiring endless hours moving back and forth or adapting the system to your requirements; time that could be spent writing your engine!

During early development of the Splinter Cell: Conviction engine we had such a system. It was a custom rendering engine hosted within the UE framework that allowed the engine programers to iterate on the engine C++ code while UnrealEd was running. Most times code changes would take a couple of seconds to build and reload within the editor and at times we could code for a few hours without bringing the editor down. It was a little brittle and would break now and again because somebody would check-in engine changes that were incompatible with the object model - whether the object model had flaws or it required too much contextual knowledge to keep working, I unfortunately never got the chance to find out.

However, you can achieve a similar system with a reflection API that has the following requirements:

* Embed your code in reasonably partitioned DLLs.
* Cross-DLL communication occurs with interfaces (abstract base classes in C++, structures of function pointers in C).
* All dynamically created objects in your game are created from the same source.
* All objects have a unique ID through which they can be serialised - usually a 32-bit CRC of the object name.

If you write a file system watcher that continously waits for changes to your DLL (or polls for it) then you can react to any change as follows:

* Identify all objects of any types in the changed DLL and store them.
* Iterate over the properties of objects that point to the collected objects. Replace the pointers with the unique ID of those objects.
* Serialise the collected objects to memory.
* Release the collected objects.
* Reload the DLL.
* Deserialise the collected objects from memory.
* Iterate over the properties of objects that point to the collected objects. Replace the unique ID with the newly allocated pointers to the objects.

The key to this is that you're serialising everything that changes and you have the ability to walk the pointer graph and patch up the objects that are kept alive with the location of the newly created objects. The serialisation can be done to RAM on PC, letting the OS take care of the paging. On consoles you can't really do that (with the exception of some debug kits) so you may have to implement a slower path that uses your network connection. Debugging is achieved simply by attaching/detaching to your process whenever necessary.

I can't stress enough how good this setup felt and how strongly I feel that every game should have it. This setup was literally serialising everything in a level within a few seconds (models, textures, data structures, etc.) without breaking a sweat.


#### Memory Mapping


Memory mapping is an old technique that in its most basic form involves loading a file from whatever storage medium you are using with one single read, not touching the result: it's usable as it is. It naturally evolved from the ROM programming model where both your code and data is defined in your code files, making limited use of slow-access RAM. There are notable cases of old Playstation games, for example, serialising the entire contents of RAM to a memory card for save games!

Of course, in these days of heavy dynamic memory allocation and far more complicated data structures, this practice is rarely used. Especially when you consider that your load times are likely dominated by seek latency, volume of data and the complexity of any compression/recompression steps you perform.

In cases where you really do need to-the-metal memory-mapped loading of specific data types you can do this:

* Walk over every pointer in the object and replace the object pointer with the hash of the object pointed to.
* Save with a single write to disk.

The loading code then becomes:

~~~cpp
// Read the memory map header for this object, which determines its type
u32 type_hash = ReadU32();
Type* type = db.GetType(type_hash);

// Read the entire object into memory
void *object = AllocateAndConstruct();
ReadBlob(object, type->size);

// Lookup each pointer hash
for (ptr in type->pointers)
{
	void* ref = object_db.GetObject((u32)ptr);
	ptr = ref;
}
~~~

Of course, you're now bound by the object lookups being performed per pointer. This can be accelerated by using bank/package files that store collections of objects with link tables. These link tables specify what objects are exported and imported, while object references now store indices into the link table. When a bank/package file is initially loaded, its import link table is updated by searching other bank/package files around it. The resolving of pointers then becomes:

~~~cpp
for (ptr in type->pointers)
{
	// The ptr now represents an index into the link table and a single bit representing
	// which link table to use
	u32 ptr_id = (u32)ptr;
	bool is_import = ptr_id & 0x80000000;
	
	// Pointer lookup is a simple array index
	if (is_import)
		ptr = import_table[ptr_id & 0x7FFFFFFF];
	else
		ptr = export_table[ptr_id & 0x7FFFFFFF];		
}
~~~


#### Conclusion


I hope nothing in the post above implies that specific techniques are the only options available to you. I've spent many years researching and implementing alternatives to the above and these are a sampling of the techniques I feel most comfortable with.

To give you an sampling of how diverse the implementations can be, I've collected some articles/implementations you may find interesting.


###### Implementations


* [Helium Reflection](https://github.com/HeliumProject/Reflect) - Initially part of the Insomniac Games Nocturnal initiative. It's an intrusive, registration-based reflection API.
* [Reflex](https://root.cern.ch/how/how-use-reflex) - Can use [GCCXML](http://www.gccxml.org/HTML/Index.html) or [CINT](http://root.cern.ch/drupal/content/cint) to parse header files and auto-generate reflection dictionaries.
* [Mirror](http://kifri.fri.uniza.sk/~chochlik/mirror-lib/html/) - Template-based, built using Boost and intended for submission to the project. Offers both compile-time and runtime databases. Contains a separate tool to automatically generate C++ registration code.
* [Qt Meta-Object System](http://doc.qt.io/qt-4.8/metaobjects.html) - The ubiquitous Qt has its own reflection system that uses a "Meta-Object Compiler" to scan C++ files for custom-marked properties that need reflecting.
* [Xrtti](http://www.ischo.com/xrtti/) - Uses GCCXML to generate C++ files that register reflection information for you.
* [Galaxy 3 Reflection](http://www.cbloom.com/3d/galaxy3/) - Intrusive, manual registration with some added template help.
* [Galaxy 4 Auto-Reflection](http://cbloomrants.blogspot.com/2009/05/05-05-09-autoreflect.html) - Uses a custom pre-processor to scan C++ files for markup, auto-generating the required C++ registration code.
* [CRD](http://sourceforge.net/projects/crd/) - Template-based with heavy STL influences. Implementation mainly in one header file.
* [cppreflect](http://www.garret.ru/cppreflection/docs/reflect.html) - Intrusive, macro-based manual registration.
* [CAMP](https://github.com/tegesoft/camp) - Template-based, manual registration with a minimal DSL-in-C++ approach.


###### Articles


* [Adventures in Data Compilation](http://www.slideshare.net/naughty_dog/adventures-in-data-compilation) - A Scheme DDL is used to generate C++ header files and runtime data files for Naughty Dog's games.
* [Metaclasses and Reflection in C++](http://www.vollmann.com/en/pubs/meta/meta/meta.html) - Classic article, one of the first in-depth C++ community discussions of reflection, describing MOP. This is another manual registration library.
* [Aspects of Reflection in C++](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2005/n1751.html) - An introduction intended to kick-off discussion about adding reflection to C++0x.
* [Advanced RTTI in C++](http://www.codeguru.com/Cpp/Cpp/cpp_mfc/rtti/article.php/c4061) - Extensive documentation of ``Oops`, an inhouse property reflection API that uses macros to manually register property information.
* [Behind the Mirror - Adding Reflection to C++](http://www.gamasutra.com/view/feature/6379/sponsored_feature_behind_the_.php) - Discussion of the Nocturnal reflection API.


###### Blog posts


* [Static reflection in C++ using minimal repetition](http://www.enchantedage.com/cpp-reflection) - Tries to reduce the inherent instability in registration-based reflection systems by embedding registration with declaration.
* [Reflection in C++](http://msinilo.pl/blog/?p=517) - A system that scans PDB files for all the reflection info it needs and makes the result loadable at runtime. There are a few more posts on the site so hunt around a bit.
* [Class Reflection in the Despair Engine](http://gameangst.com/?p=107) - Uses template-based registration with an attempted DSL-in-C++ approach.

This is a bit of a big post and I'd like to thank everybody who's reviewed it for me. Special mentions go to Stephen Hill who made several tireless passes and Patrick Duquette, who cleared the road at Ubisoft for me to talk about the SC5 stuff.
