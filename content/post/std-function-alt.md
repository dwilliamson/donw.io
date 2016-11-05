+++
date = "2016-10-06T00:04:20+01:00"
draft = true
title = "A Simpler, Bindable std::function"
tags = [ "c++" ]
+++

The purpose of `std::function` is to be a unified abstraction around callable entities such as:

* Free functions (including class static functions).
* Class methods (class member functions).
* `operator()`-callable objects (functors).
* Lambas.

Each of these resolve to different types and can not be readily assigned to the same type without library intervention. `std::function` can be combined with `std::bind` to forward pre-defined values to a function, only requiring the caller to pass unspecified values. A simple example would be:

```cpp
// Bind a method to an object 
std::function<void()> f = std::bind(&Class::method, &class_instance);

// Method is now callable as a void() function
f();
```

Contents of this blog post:

* [Motivation]({{< relref "#motivation" >}})
* [Wrapping Function Pointers]({{< relref "#wrapping-function-pointers" >}})
* [The Virtual Abstraction]({{< relref "#the-virtual-abstraction" >}})
* [Wrapping Class Functions]({{< relref "#wrapping-class-functions" >}})
* [Storing Parameter References]({{< relref "#storing-parameter-references" >}})
* [Storing Parameter Copies]({{< relref "#storing-parameter-copies" >}})
* A Case for Language Support
* DO NOT USE std::function Variants

---

##### Motivation

While these types are largely well written within the scope of the problem they set out to solve, there is a lot of room for improvement if you're prepared to compromise. Specifically, these issues can be addressed:

* The implementations are very large and drag in many thousands of lines of code that slow compile times and lead to more generated code than there needs to be.
* Debug builds are incredibly important and games should require them to perform well. STL implementations in particular lead to a maze of poorly-performing code that's very difficult to step-debug. That your implementation reduces to a single instruction in release is pointless if it renders your debug builds unusable.
* Large amounts of generated template code leads to an increased burden on the linker in builds that strive to coalesce sections of generated code that are the same.
* Simpler template code allows compilers to easier reason about side-effects and inline/discard more generated code.
* Compilers are notoriously bad at reporting user errors with template libraries. Simpler template code reduces this issue but will not solve it completely.
* STL versions differ between platforms, with enough subtle differences to cause a maintenance burden. STLport used to be a common way of addressing this but that hasn't been updated in many years.

It's important to bear in mind that the STL needs to cater for the needs of as many users as possible. We, in comparison, need to cater for orders of magnitude less scenarios and have room to work with much simpler code. As long as the implementation does also not introduce unnecessary technical debt (e.g you don't try to write a full-blown replacement), the returns can be good.

Some compromises made:

* Bind all parameters or no parameters. Partial parameter lists are not supported.
* There is no support for positional parameter reassignment or reuse.
* Method pointers are always bound to an object.
* Functions transfer ownership on copy.
* No explicit allocator model (my main use-case could source non-heap allocations without this).

The loss of more general argument binding was a net-win for me considering that everywhere I've rolled out a similar solution in the past, people would complain of API complexity. The limited use-cases for partial argument binding did not warrant the obsfuscated call sites and larger implementation, especially given modern C++ supports lambdas.

To summarise; this article will build a much simpler, bindable std::function with no standard library dependencies.

---

##### Wrapping Function Pointers

First comes the class itself:

```cpp
// Introduce the class as a forward declaration only, requiring specialisations
// to specify valid instantiations. Function call arguments typed with 
// variadic templates.
template <typename Functor, typename... Arguments>
struct Function;

// Specialisation with function signature
template <typename Return, typename... Arguments>
struct Function<Return(Arguments...)>
{
	// Call operator for the function, passing arguments as
	// rvalue references so that perfect forwarding can be used
	Return operator() (Arguments&&... arguments);
};
```

The easiest case to address is binding free functions:

```cpp
template <typename Return, typename... Arguments>
struct Function<Return(Arguments...)>
{
	Function(Return (*function)(Arguments...)) : arguments(arguments) { }

	Return operator() (Arguments&&... arguments)
	{
		// Unpack the arguments and forward them onto the user function
		return function(std::forward<Arguments>(arguments)...);
	}

	// Function pointer that matches template signature
	Return (*function)(Arguments...);
};

int fn(char, short) { 	}

// Example construction and use
Function<int(char, short)> f(&fn);
f('a', 1);
``` 

When used in combination with rvalue reference parameters, `std::forward<T>(t)` is a wrapper around `static_cast<T&&>(t)`. This is a new C++11 construct that can be used to employ perfect forwarding of function arguments to another function; an [historically tricky problem](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2002/n1385.htm) with no ideal solution. From [a talk](http://scottmeyers.blogspot.co.uk/2012/11/on-superfluousness-of-stdmove.html) by Scott Meyers, pseudo-code for the implementation is:

```cpp
template<typename T> T&& std::forward(T&& obj)
{ 
	if (T is a reference)
		return (T&)obj;		// return obj as an lvalue 
	else
		return (T&&)obj;	// return obj as an rvalue 
}
```

One possible implementation would be:

```cpp
// If a type is a reference, partial specialisations will remove it
template <typename T> struct RemoveReferenceImpl		{ using Type = T; };
template <typename T> struct RemoveReferenceImpl<T&>	{ using Type = T; };
template <typename T> struct RemoveReferenceImpl<T&&>	{ using Type = T; };

// Helper to automate typename prefix and ::Type specification
template <typename T> using RemoveReference = typename RemoveReferenceImpl<T>::Type;

// Use RemoveReference to force everything through the else branch
template <typename T> T&& Forward(RemoveReference<T>& arg)
{
	return static_cast<T&&>(arg);
}
```

There is no actual need for a `std::forward` function as you can just use `static_cast<T&&>(t)` wherever you intend to use perfect forwarding. Introducing such a function requires you pay a library overhead for potentially making call sites a little clearer.

---

##### The Virtual Abstraction

Right now this is a pretty pointless abstraction as there is no benefit to using `Function` over a simple function pointer. The next step would be to add support for functors and lambdas. There's no exceptional reason for me to support functors, it's more that their support falls out of the code required for lambas. The use cases are:

```cpp
// Support lambdas with capture
int x = 3;
Function<int(char, short)> f0([=](char a, short b){ return a + b + c; } -> int);
f0('a', 1);

// Support functors with state
struct Functor
{
	Functor(int x) : x(x) { }
	int operator () (char a, short b) const { return a + b + c; }
	int x;
};
Function<int(char, short)> f1(Functor());
f1('b', 2);
```

`Function` can clearly no longer store just a function pointer; the object stored must vary depending on the type of object used to create it and must expose a callable interface shared by all types. The most general solution involves creating an abstract base class for callable objects to implement:

```cpp
// Anonymous Caller interface
template <typename Return, typename... Arguments>
struct Caller;
{
	// Destructor needed for cleaning up lambda/functor state
	virtual ~Caller() { }

	virtual Return Call(Arguments&&...) = 0;
};
```

This can then be implemented by a single type that can store references to functions, functors or lambdas:

```cpp
template <typename Functor, typename Return, typename... Arguments>
struct FunctorCaller : public Caller<Return, Arguments...>
{
	FunctorCaller(const Functor& functor)
		: functor(functor)
	{
	}
	virtual Return Call(Arguments&&... arguments) final
	{
		return functor(Forward<Arguments>(arguments)...);
	}

	// A copy of the passed in object, allowing functor/lambda state to be preserved and used later
	Functor functor;
};
```

With those in place, `Function` can be updated:

```cpp
template <typename Return, typename... Arguments>
struct Function<Return(Arguments...)>
{
	// Templated constructor to accept any callable object
	template <typename Functor>
	Function(const Functor& functor)
		: caller(new FunctorCaller<Functor, Return, Arguments...>(functor))
	{
	}

	~Function()
	{
		// Cleanup functor/lambda state
		delete caller;
	}

	Return operator() (Arguments&&... arguments)
	{
		// Unpack the arguments and forward them onto the caller implementation
		return caller->Call(Forward<Arguments>(arguments)...);
	}

	// Pointer to caller implementation
	Caller<Return, Arguments...>* caller;
};
```

---

##### Wrapping Class Functions 

The abstraction as it stands can accept class methods as construction arguments but there are some problems:

* The syntax for calling methods is different from that of functions and so will cause a compile errors.
* You need an object pointer to call the method on and that isn't specified or stored anywhere.
* Methods can haave const/volatile qualifiers that change its type.

Another implementation of `Caller` can be added to store and calli methods:

```cpp
// Make no explicit method pointer type, instead allowing it to vary so that const/volatile differences
// can use the same MethodCaller
template <typename Object, typename Method, typename Return, typename... Arguments>
struct MethodCaller : public Caller<Return, Arguments...>
{
	// Construct with both 'this' pointer and method pointer
	MethodCaller(Object* object, Method method)
		: object(object)
		, method(method)
	{
	}

	Return Call(Arguments&&... arguments) final
	{
		return (object->*method)(Forward<Arguments>(arguments)...);
	}

	Object* object;
	Method method;
};

```

The implementation of `Function` needs two further constructors:

```cpp
// Construct from non-const methods and bind to an object
template <typename Object>
Function(Object* object, Return(Object::*method)(Arguments...))
	: caller(new MethodCaller<Object, Return(Object::*)(Arguments...), Return, Arguments...>
		(object, method))
{
}

// Construct from const methods 
template <typename Object>
Function(const Object* object, Return(Object::*method)(Arguments...) const)
	: caller(new MethodCaller<const Object, Return(Object::*)(Arguments...) const, Return, Arguments...>
		(object, method))
{
}
```

Use is simple:

```cpp
struct Class
{
	Class(int b) : b(b) { }
	int Do(int a) { return a + b; }
	int b;
};

Class c(3);
Function<int(int)> f(&c, &Class::Do);
f(2);
```

The original `std::function` requires the use of `std::bind` with the object in order to store references to methods. This simplified interface is a good example of the reduction in scope.

---

##### Storing Parameter References

The next challenge is to bind parameters to specific function calls, similar to what `std::bind` does. This requires parameters passed into a `Function` to be stored within the class. With variadic templates, it would be good if we could do this:

```cpp
template <typename... Arguments>
struct Class
{
	// for each argument in Arguments
	//    add a new data member
};
```

Unfortunately, variadic template packing/unpacking only works in terms of parameter arguments and this isn't directly possible. One way to achieve this is to enlist compile-time Type Lists, a concept I first saw discussed in Alexandrescu's [Modern C++ Design](http://erdani.com/index.php/books/modern-c-design/). This can be expressed by the `Tuple` class:

```cpp
// A Tuple is effectively a type linked list with values stored for each type
// Repeatedly split a type list into (i, i+1...N) pairs, recursively inheriting
// from the second half until there's nothing left; similar to Lisp's car/cdr.
template <typename First, typename... Rest>
struct Tuple : public Tuple<Rest...>
{
	using Value = First;
	using Next = Tuple<Rest...>;

	// Constructor for unpacking an argument list
	// Ensure perfect parameter forwarding is used
	Tuple(First&& first, Rest&&... rest)
		: Next(Forward<Rest>(rest)...)
		, value(first)
	{
	}

	Value value;
};

// Terminate a tuple's type list
template <typename First>
struct Tuple<First>
{
	using Value = First;
	// Next not here to cause compile error on attempt to reference

	Tuple(First&& first)
		: value(first)
	{
	}

	First value;
};
```

`Tuple` now allows construction of arbitrary lists of types with accompanying values:

```cpp
using T = Tuple<int, char, float, double>;
T tuple(10, 65, 3.141592f, 2.718281);
```

Starting with Functors, we can build a new `Caller` implementation that copies parameter references from a variadic template argument list:

```cpp
// No need to specify both an argument list and a bound argument list as there
// is only support for binding all arguments and those are encoded in 'Functor'
template <typename Functor, typename Return, typename... BoundArguments>
struct BoundFunctorCaller : public Caller<Return>
{
	BoundFunctorCaller(const Functor& functor, BoundArguments&&... arguments)
		: functor(functor)
		, arguments(Forward<BoundArguments>(arguments)...)
	{
	}

	// No Call implementation yet; that's covered later

	Functor functor;

	// Unpack bound template arguments to create Tuple type list of them and their values
	Tuple<BoundArguments...> arguments;
};
```

The associated `Function` constructor can look like:

```cpp
template <typename Functor, typename... BoundArguments>
Function(const Functor& functor, BoundArguments&&... arguments)
	: caller(
		new BoundFunctorCaller<Functor, Return, BoundArguments...>
			(functor, Forward<BoundArguments>(arguments)...))
{
}
```

As mentioned in the title, this only stores references to the incoming parameters and we want to store copies. If you pass an `int` lvalue to the constructor, the argument type will be deduced as `int&`. Even worse, the constructor will refuse to accept rvalues of type `int`.

---

##### Storing Parameter Copies

To make the problem a little clearer, consider this test:

```cpp
// Deduce a packed list of template argument types, construct a Tuple and display its type
template <typename... BoundArguments>
void Deduce(BoundArguments&&... arguments)
{
	using T = Tuple<BoundArguments...>;
	T bound(Forward<BoundArguments>(arguments)...);
	printf("%s\n", typeid(T).name());
}

// Test
Type t;
int x = 1;
Deduce(x, t);

// This causes a compile error
//Deduce(1, Type());

// OUTPUT:
// struct Tuple<int &,struct Type &>

```

It's clear that the bound argument types need to be transformed into something that stores copies instead of references. The specific goals of this transformation would be:

* If the type is a C array convert it to a pointer.
* If the type is a function type convert to a function pointer.
* Else just remove all cv-qualifiers and references but maintain pointers.

You'll need a whole bunch of little tools before you can address this problem and they can be reduced to:

```cpp
// Types can inherit from these to conveniently aggregate true/false values
struct True		{ static const bool value = true; };
struct False	{ static const bool value = false; };

// Checks to see if a type is a C array
template <typename TYPE>		struct IsArray : False { };
template <typename TYPE>		struct IsArray<TYPE[]> : True{};
template <typename TYPE, int N> struct IsArray<TYPE[N]> : True{};

// Checks to see if a type is a function type
template <typename>					struct IsFunction : False { };
template <class Ret, class... Args> struct IsFunction<Ret(Args...)> : True{};
template <class Ret, class... Args> struct IsFunction<Ret(Args..., ...)> : True{};

// Remove const from a type if it exists
template <typename TYPE> struct RemoveConstImpl				{ using Type = TYPE; };
template <typename TYPE> struct RemoveConstImpl<const TYPE>	{ using Type = TYPE; };
template <typename TYPE> using	RemoveConst = typename RemoveConstImpl<TYPE>::Type;

// Remove volatile from a type if it exists
template <typename TYPE> struct RemoveVolatileImpl					{ using Type = TYPE; };
template <typename TYPE> struct RemoveVolatileImpl<volatile TYPE>	{ using Type = TYPE; };
template <typename TYPE> using	RemoveVolatile = typename RemoveVolatileImpl<TYPE>::Type;

// Remove const/volatile from a type if it exists
template <typename TYPE> using	RemoveCV = RemoveConst<RemoveVolatile<TYPE>>;

// Remove a pointer from a type if it exists
template <typename TYPE> struct RemovePointerImpl			{ using Type = TYPE; };
template <typename TYPE> struct RemovePointerImpl<TYPE*>	{ using Type = TYPE; };
template <typename TYPE> using	RemovePointer = typename RemovePointerImpl<TYPE>::Type;

// Remove a reference from a type if it exists
template <typename TYPE> struct RemoveReferenceImpl			{ using Type = TYPE; };
template <typename TYPE> struct RemoveReferenceImpl<TYPE&>	{ using Type = TYPE; };
template <typename TYPE> struct RemoveReferenceImpl<TYPE&&>	{ using Type = TYPE; };
template <typename TYPE> using	RemoveReference = typename RemoveReferenceImpl<TYPE>::Type;

// Remove array qualifiers if present
template <typename TYPE> 		struct RemoveExtentImpl					{ using Type = TYPE; };
template <typename TYPE> 		struct RemoveExtentImpl<TYPE[]>			{ using Type = TYPE; };
template <typename TYPE, int N> struct RemoveExtentImpl<TYPE[N]>	{ using Type = TYPE; };
template <typename TYPE> 		using  RemoveExtent = typename RemoveExtentImpl<TYPE>::Type;

// Adds a pointer qualifier to a type
template <typename TYPE> using AddPointer = RemoveReference<TYPE>*;

// Conditional type selection
template <bool, typename A, typename B> 		struct IfImpl { using Type = B; };
template<typename A, typename B>				struct IfImpl<true, A, B> { using Type = A; };
template <bool Cond, typename A, typename B>	using  If = typename IfImpl<Cond, A, B>::Type;
```

With these and the transformation requirements, a new type similar to `std::decay` can be introduced:

```cpp
template<class TYPE>
struct DecayImpl
{
	using ReflessType = RemoveReference<TYPE>;
	using Type =
		If<IsArray<ReflessType>::value,
			RemoveExtent<ReflessType>*,
			If<IsFunction<ReflessType>::value,
				AddPointer<ReflessType>,
				RemoveCV<ReflessType>>>;
};
template <typename TYPE> using Decay = typename DecayImpl<TYPE>::Type;
```

`Decay` is then used to transform the type into something storable:

```cpp
template <typename Functor, typename Return, typename... BoundArguments>
struct BoundFunctorCaller : public Caller<Return>
{
	// Unpack bound template arguments to create Tuple type list of them and their values
	Tuple<Decay<BoundArguments>	...> arguments;
};
```

Stored like this, parameters will have been taken out of their packed argument form and thus

---
Decay functor ONLY for VC2013
What you can achieve with custom allocators (use container storage)
Code-gen numbers
godbolt links
Decay the function reference?
Manual writing of template variants
Use of pycgen

---
* http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2002/n1385.htm
* http://stackoverflow.com/questions/3582001/advantages-of-using-forward/3582313#3582313
* http://scottmeyers.blogspot.co.uk/2012/11/on-superfluousness-of-stdmove.html
* https://channel9.msdn.com/Shows/Going+Deep/Cpp-and-Beyond-2012-Scott-Meyers-Universal-References-in-Cpp11
