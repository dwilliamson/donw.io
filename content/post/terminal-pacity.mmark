+++
date = "2017-05-19T15:21:27+01:00"
draft = false
title = "20 Years since Terminal Pacity"
ghcommentid = 13
+++

Around the age of 15 I started to code after a family friend gave me a [BBC Microcomputer Model B](http://www.computinghistory.org.uk/det/182/acorn-bbc-micro-model-b/) that his local army barracks were throwing away. Though primitive, it was a wonderful machine that showed me where my future lay. I learned [BBC BASIC](http://www.bbcbasic.co.uk/bbcbasic.html) and a smattering of [6502 Assembly](http://central.kaserver5.org/Kasoft/Typeset/BBC/Ch43.html) to gain performance and then moved on to PC.

I bought a second-hand 286 PC for something like £20 and migrated to [QBasic](http://www.qbasic.net/) and x86 Assembly using [Gavin Estey's tutorials](https://stuff.pypt.lt/ggt80x86a/asm1.htm). Although having no real knowledge of how professional games were made, I'd heard about a mystical language called C that I was eager to learn. Back in 1995 I had a 28.8 baud modem that my parents were strictly controlling due to phone bills; I'd be allowed about 15 minutes each day and no more.

The next year, at the age of 16 a friend left his Learning C book behind at school on the last day before the summer holidays. Over the next 4 months I got up to scratch on C and built Terminal Pacity, the first game that I sold as Shareware:

<center> {{< iframe "/termpac/termpac.html" >}} </center>

<center>(emulation in the browser is a little dicey - it took me a while to find a CPU cycle count that worked)</center>

Here's a whole bunch of things that I'd done for the game:

* Majority of game written in C to target Mode 13h, with some inline Assembly.
* Per-pixel collision detection with forward-difference motion, jumping and ledge hanging.
* EMS memory management to fit sound effects in memory.
* Sound Blaster audio with DMA scheduling and port/IRQ auto-detection.
* Custom level editor for the game with ability to load user levels from the command-line.
* A single EXE game installer with its own text mode user interface, modelled on the old id Software ones.
* Save game support.
* Designed all the audio sound effects and music.
* Designed all graphics, mostly with [POV-Ray](http://www.povray.org/).
* Designed 6 of the 8 levels in the game; the other 2 designed by school friends.
* Allowed custom user skinning of levels.

It was a short-term labour of love that took around 7 months in total to polish and sell (homework did suffer a bit). There were a few great website reviews at the time, with a nice collection of game CDs choosing to include it. However, it's now mostly disappeared from the web, especially given the [Geocities](http://www.archiveteam.org/index.php?title=GeoCities) collapse.

After release I moved onto learning other stuff at an increased rate and started to get job offers in the games industry. One was from Lionhead as a junior coder when they were in the first few months of writing Black & White. I said no for many reasons and started at a company local to where I lived instead. Who'd have thought that 10 years later I'd finally end up back there!

I've uploaded as much code as I can find to [Github](https://github.com/dwilliamson/TerminalPacity). It's thoroughly embarassing but I'd only been coding for about a year. We all have to start somewhere, I suppose. The repository also contains a version of the game and editor that have DOSBox embedded, so you can run it straight from Windows for lag-free gameplay and use of save games.

