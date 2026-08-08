# Design log

Every message sent by the user in the conversation that produced this
project, in order, verbatim. Nothing from the assistant. Tool-system
artifacts (slash commands, tool-rejection notices) are omitted where they
carried no authored content of their own.

## Rating & queue system design (the original topic)

> I need to make a rating and queue system for this game but I want it to be specific for this game brand new methods. This game is highly dependant on your team

> I am thinking that for each other player compared to the player we are taking their skill + certainty and doing some math to figure out the estimated skill on loss and estimated skill on win and compare it to current skill to figure out how much to move

> well it takes both your teammate and your enemies. teammates add enemies subtract and you get the expected elo on a loss or rather a range and the same for a win. At the end it takes your epxected elo and your current elo and moves your certainty and elo towards it

> but I want certainty to be another factor for the player to think about. Someone may be in the top 10 based on elo but accounting for certainty they should be somewhere between the top 3 and top 60

> maybe not range but something like greater than this elo manes you winn but less than means you lose and inbetween is uncertain

> idk there must be a better way to do this. maybe evolution based somehow

> so it's a difference between making the best option vs choosing the best option

> it kinda is like evolution. if we think as the player as elo and they are looking for a certain elo where they win and lose at the same rate. so we adjust with random variation and eventually they will all land in the right spot

> successful teams are like children. unsucceesful is like death. and maybe we can use something other than elo. we can use variables based on stats or something and adjust those variables and it makes it like a this stat does good with this stat if lose then lose even more than usual

> I wonder if instead of using concrete attributes like offense defense carrying disruption we use random numbers and tune them based on wins and losses with other players so it creates attributes based on something unknown

> well it bases it on how often you win with other attributes

> we need to maxamize the suality of attributes where if all 4 players on the team have the same atribute they will probably lose

> I also care a lot about data. I am the resident tagpro theorizer so more data the better

> we already have replays

## Pivot: a strategy-evolution game instead

> I want to make a game where you use random algorithms to decide the players strategy on a different game and you pair all the strategies against eachother in teams with the same attribute. Like a race game on randomly generated maps with people connected to ropes some people just hold forward and jump when they hit a wall others try and jump on top of the wall etc

> needs to be something easier to team up agents and develop strategies preferably turn based

> we can use go. we don't need sophisticated strategeies just repeating strategies on a 9x9 and we let them alternate moves on teams of 2 and we jusge the winners and we do the random attribute assigning i want it to be a full fledged scientific test try ith a bunch or a little bit of variables

> the hard part is the strategy. making a bot that always plays randomly or always plays one stone away from it's previous stone etc

> board game

## The strategy catalog

> always lower your teammates liberties or something

> well no always lowers the enemy liberties

> one space and 2 space jump bot always fovor edge if possible if not go mid

> ok build it. bur we need to make it so we can view each bots past game just make it lines and circles and we see their partner the alternate moves

> make a control panel with a bunch of different adjusters and a run test button and i can see each bots bars move up and down

> and a best teammates and worst teammates thing. I can also view any two teams and see who they did best and worse against

> where

> make server

> make it just easy to see every game use the default go storage method and left and right arrow to go between games each bot has a profile and i can look at their games

> try to stay on the 3rd line until you are cut off then go down a line

> each corner has a state and you attach to the last stone of that corner

> make the corner seeker start at a star point right away and just keep extending that stone by one move every time

> well try and do it for multiple star points choose which one to extend based on which one the enemy went into

## Infrastructure & deployment

> how can I move this to my other ssh'd computer both you and the project

> upload current files to github

> upload to the goatt repo

> make it use a server for simulating games and browser just sees results

> do 0 komi

> cancel your tasks make a md file and push to github

> include all of my messages but not yours
