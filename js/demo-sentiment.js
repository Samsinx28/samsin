/**
 * demo-sentiment.js
 * ─────────────────────────────────────────────
 * Demo 2: Sentiment Analysis (Client-side VADER)
 *
 * A JavaScript port of the Python VADER sentiment
 * analysis algorithm. Runs 100% in the browser —
 * no API calls, no backend.
 *
 * Features:
 *   - Expanded VADER lexicon (positive, negative,
 *     profanity, slurs, internet slang)
 *   - Negation handling ("not good" → negative)
 *   - Booster words ("very", "barely", etc.)
 *   - Exclamation mark intensity boosting
 *   - Compound score normalisation
 *   - Per-sentence breakdown
 *   - Token-level colour-coded annotation
 *   - Intensity + subjectivity metrics
 *   - Auto-analyse on input (400 ms debounce)
 * ─────────────────────────────────────────────
 */
(function() {

// ── Expanded sentiment lexicon ────────────────────────────────────────────
const LEXICON = {
  // ── Profanity core ──
  "fuck":-4,"fucked":-4,"fucking":-4,"fucker":-4,"fucks":-3,"fuckup":-4,
  "fuckface":-4,"fuckwit":-4,"fuckhead":-4,"motherfucker":-4,"motherfucking":-4,
  "unfuck":-3,"clusterfuck":-4,"mindfuck":-3,"buttfuck":-4,"tf":-2,
  "wtf":-3,"stfu":-3,"gtfo":-3,"omfg":-2,
  "shit":-3,"shitty":-3,"bullshit":-3,"bullshitting":-3,"shithead":-4,
  "shitstorm":-4,"shitshow":-4,"shithole":-4,"shitfaced":-3,"shitlist":-3,
  "horseshit":-3,"dogshit":-4,"batshit":-3,"shitbag":-4,"shitpost":-2,
  "ass":-2,"asshole":-4,"assholes":-4,"jackass":-3,"smartass":-2,
  "dumbass":-3,"fatass":-3,"badass":2,"hardass":-1,"lardass":-3,
  "asshat":-3,"asswipe":-4,"assfuck":-4,"assclown":-3,
  "bastard":-3,"bastards":-3,"bastardly":-3,
  "bitch":-4,"bitchy":-3,"bitches":-3,"bitching":-3,"bitchass":-4,
  "son of a bitch":-4,"sob":-3,"biatch":-3,"beeyatch":-3,
  "dick":-3,"dicks":-3,"dickhead":-4,"dickface":-4,"dickwad":-4,
  "dickweed":-3,"dickish":-3,"tiny dick":-3,
  "cock":-3,"cockhead":-4,"cocksucker":-4,"cocksucking":-4,"cocky":-2,
  "cunt":-4,"cunts":-4,"cunty":-4,"cuntface":-4,
  "pussy":-3,"pussies":-3,"pussyass":-4,
  "twat":-3,"twats":-3,"twatface":-4,
  "prick":-3,"pricks":-3,"prickish":-3,
  "wanker":-3,"wankers":-3,"wank":-3,"wanking":-3,
  "tosser":-3,"tossers":-3,
  "bellend":-3,"bellends":-3,
  "knobhead":-3,"knob":-2,
  "arsehole":-4,"arse":-2,
  "damn":-2,"damned":-2,"dammit":-2,"goddamn":-3,"goddammit":-3,
  "crap":-2,"crappy":-2,"craphole":-3,"crapper":-2,
  "hell":-1,"hellhole":-3,"bloody hell":-2,
  "screw":-2,"screwed":-3,"screws":-2,"screwyou":-3,
  "suck":-3,"sucks":-3,"sucked":-3,"sucking":-3,"suckage":-3,
  "blows":-3,"blew":-2,

  // ── Slurs — racial / ethnic ──
  "nigger":-4,"nigga":-3,"nigg":-4,"niggers":-4,
  "chink":-4,"chinks":-4,"chinky":-4,
  "gook":-4,"gooks":-4,
  "spic":-4,"spics":-4,"spick":-4,
  "wetback":-4,"wetbacks":-4,
  "beaner":-4,"beaners":-4,
  "kike":-4,"kikes":-4,
  "raghead":-4,"ragheads":-4,"towelhead":-4,
  "camel jockey":-4,"sand nigger":-4,
  "cracker":-3,"crackers":-3,
  "honky":-3,"honkeys":-3,
  "whitey":-2,
  "jungle bunny":-4,"porch monkey":-4,"coon":-4,"coons":-4,
  "jigaboo":-4,"spook":-3,"sambo":-4,
  "zipperhead":-4,
  "slant":-3,"slants":-3,"slant eye":-4,
  "slope":-3,
  "curry muncher":-4,
  "pakki":-4,"paki":-4,"pakis":-4,
  "wog":-4,"wogs":-4,
  "heeb":-4,"heebs":-4,"hymie":-4,
  "greaseball":-3,"dago":-4,"degos":-4,"wop":-3,"wops":-3,
  "guinea":-3,"guido":-2,
  "mick":-3,"paddy":-3,
  "kraut":-3,"krauts":-3,"fritz":-2,
  "frog":-2,"frogs":-2,
  "polack":-3,"polacks":-3,
  "spade":-3,"spades":-3,
  "jap":-4,"japs":-4,
  "nip":-4,"nips":-4,
  "chinaman":-4,
  "redskin":-4,"redskins":-4,"injun":-4,"squaw":-4,
  "halfbreed":-3,"half breed":-3,

  // ── Slurs — gender / sexuality ──
  "fag":-4,"faggot":-4,"faggots":-4,"fagg":-4,"fags":-4,
  "dyke":-3,"dykes":-3,
  "tranny":-4,"trannies":-4,"shemale":-4,"heshe":-3,
  "trап":-4,
  "homo":-3,"homos":-3,
  "queer":-2,
  "lesbo":-3,"lesbos":-3,
  "sissy":-3,"sissies":-3,
  "pansy":-3,"pansies":-3,
  "fruit":-3,"fruity":-3,
  "queen":-1,
  "pervert":-3,"perverts":-3,"pervy":-3,
  "pedophile":-4,"pedo":-4,"pedos":-4,"nonce":-4,"groomer":-4,

  // ── Slurs — disability ──
  "retard":-4,"retarded":-4,"retards":-4,
  "tard":-4,"tards":-4,
  "spaz":-3,"spastic":-4,
  "cripple":-3,"cripples":-3,
  "gimp":-3,"gimps":-3,
  "autistic":-2,"autist":-3,
  "schizo":-3,"psycho":-3,"nutjob":-3,
  "crazy":-2,"insane":-2,"lunatic":-2,"maniac":-2,
  "mental":-2,"deranged":-2,

  // ── Slurs — weight / appearance ──
  "fatso":-3,"fatty":-3,"fat ass":-3,"lard":-3,"lardo":-3,
  "pig":-3,"slob":-3,"disgusting pig":-4,
  "ugly":-2,"uggo":-3,"hideous":-3,
  "skank":-3,"skanky":-3,"slag":-3,"slut":-4,"slutty":-3,"sluts":-4,
  "whore":-4,"whores":-4,"whorish":-3,
  "hoe":-3,"hoes":-3,
  "thot":-3,"thots":-3,
  "gold digger":-3,
  "trash":-3,"trashy":-3,"white trash":-3,

  // ── Internet insults / toxicity ──
  "kys":-4,"kill yourself":-4,"go kill yourself":-4,
  "kms":-3,"kill me":-2,
  "die in a fire":-4,"neck yourself":-4,"rope yourself":-4,
  "drink bleach":-4,
  "touch grass":-2,"get a life":-2,
  "loser":-3,"losers":-3,"absolute loser":-4,
  "incel":-3,"incels":-3,
  "simp":-2,"simps":-2,"simping":-2,
  "virgin":-2,"kissless virgin":-3,"khv":-3,
  "neckbeard":-3,"neckbeards":-3,
  "basement dweller":-3,"shut in":-2,
  "brainlet":-3,"smoothbrain":-3,"smooth brain":-3,
  "mouthbreather":-3,"mouth breather":-3,
  "knuckle dragger":-3,
  "waste of space":-4,"waste of oxygen":-4,
  "worthless piece of shit":-4,"useless piece of shit":-4,
  "garbage person":-3,"human garbage":-4,
  "subhuman":-4,"inhuman":-3,
  "vermin":-4,"parasite":-3,"leech":-3,
  "scum":-4,"scumbag":-4,"scumball":-4,
  "creep":-3,"creeps":-3,"creepy":-3,"creeper":-3,
  "weirdo":-2,"weirdo":-2,
  "freak":-3,"freaks":-3,
  "reject":-2,"social reject":-3,
  "clown":-3,"clowns":-3,"clownish":-3,
  "bozo":-2,"bozos":-2,
  "buffoon":-3,"fool":-2,"dolt":-2,
  "nitwit":-3,"halfwit":-3,"dimwit":-3,"twit":-2,
  "dork":-2,"dorks":-2,
  "nerd":-1,"geek":-1,
  "bot":-2,"npc":-2,"sheep":-2,
  "shill":-2,"shills":-2,
  "troll":-2,"trolls":-2,"trolling":-2,
  "hater":-2,"haters":-2,"hating":-3,
  "toxic":-3,"toxic person":-3,
  "abuser":-3,"abusers":-3,
  "bully":-3,"bullies":-3,"bullied":-3,"bullying":-3,
  "stalker":-3,"stalkers":-3,
  "manipulator":-3,"gaslighter":-4,"gaslighting":-4,
  "narcissist":-3,"narcissistic":-3,
  "psychopath":-3,"sociopath":-3,
  "coward":-3,"cowardly":-2,"cowards":-3,
  "spineless":-3,"gutless":-3,
  "pathetic":-3,"pitiful":-3,"pitiable":-2,
  "degenerate":-3,"degenerates":-3,
  "filth":-4,"filthy":-3,
  "disgusting":-3,"disgust":-3,"disgusted":-3,
  "repulsive":-3,"repulse":-3,"repulsed":-3,
  "revolting":-3,"revolted":-3,
  "nauseating":-3,"nauseous":-2,
  "vile":-4,"vicious":-3,
  "malicious":-3,"malice":-3,
  "wicked":-3,"sinister":-3,"evil":-3,
  "monster":-3,"demon":-3,
  "predator":-4,"groomer":-4,
  "criminal":-3,"convict":-2,"felon":-2,
  "thief":-3,"thieve":-3,"stealing":-2,"larceny":-2,
  "rapist":-4,"rape":-4,"molest":-4,"molester":-4,
  "assault":-3,"assaulted":-3,"assaulting":-3,
  "murder":-4,"murderer":-4,"kill":-3,"killed":-3,"killing":-3,
  "terrorist":-4,"terrorism":-4,
  "extremist":-3,"radical":-2,
  "nazi":-4,"fascist":-3,"bigot":-3,"bigots":-3,"bigotry":-3,
  "supremacist":-4,"supremacy":-3,
  "racist":-4,"racism":-4,"racist":-4,
  "sexist":-3,"sexism":-3,"misogynist":-4,"misogyny":-4,
  "homophobe":-3,"homophobic":-3,"homophobia":-3,
  "transphobe":-3,"transphobic":-3,"transphobia":-3,
  "islamophobe":-3,"antisemite":-4,"antisemitic":-4,

  // ── Internet slang negative ──
  "smh":-2,"fml":-3,"omfg":-2,
  "af":-1,"mid":-2,"cap":-2,"ngl":-1,
  "bruh":-1,"yikes":-3,"oof":-2,"rip":-2,
  "cringe":-2,"cringy":-2,"cringey":-2,"cringe worthy":-2,
  "sus":-2,"sussy":-2,
  "ratio":-2,"ratioed":-2,
  "l":-2,"big l":-3,"massive l":-3,"take the l":-2,
  "cope":-2,"copium":-2,"skill issue":-2,"malding":-2,
  "rent free":-1,"stay mad":-2,"mad":-2,
  "boomer":-1,"okay boomer":-2,
  "karen":-2,"karens":-2,
  "chad":-1,"virgin vs chad":-2,
  "seethe":-2,"seething":-3,"mald":-2,
  "clapped":-2,"garbage":-3,"garbagy":-2,
  "trash fire":-3,"dumpster fire":-3,
  "disaster":-3,"disastrous":-3,
  "catastrophic":-4,"catastrophe":-4,
  "fail":-2,"failed":-2,"failure":-2,"fail":-2,"epic fail":-3,
  "flop":-2,"flopped":-2,"flopping":-2,
  "scam":-3,"scammer":-3,"scammed":-3,
  "rigged":-2,"fake":-2,"phony":-2,"bogus":-2,
  "overrated":-2,"overhyped":-2,
  "boring":-2,"bored":-2,"boredom":-2,
  "bland":-1,"mediocre":-1,"average":-1,
  "lame":-2,"lamer":-2,"lamest":-2,
  "crappy":-3,"crap":-2,
  "meh":-1,"blah":-1,
  "nah":-1,"nope":-1,"no way":-1,

  // ── Emotional / psychological negative ──
  "hate":-4,"hated":-4,"hates":-4,"hating":-4,"hateful":-3,"hatred":-4,
  "loathe":-4,"loathed":-4,"loathing":-4,
  "despise":-4,"despised":-4,"despises":-4,
  "detest":-3,"detested":-3,"detests":-3,
  "abhor":-3,"abhorred":-3,"abhorrent":-3,
  "rage":-3,"raging":-3,"raged":-3,"rages":-3,
  "furious":-3,"fury":-3,"fuming":-3,
  "angry":-3,"anger":-3,"angered":-3,"angrily":-3,
  "irate":-3,"livid":-3,"seething":-3,
  "hostile":-2,"hostility":-2,
  "aggressive":-2,"aggression":-2,"aggressively":-2,
  "threaten":-2,"threatened":-2,"threatening":-2,"threat":-2,
  "intimidate":-2,"intimidated":-2,"intimidating":-2,
  "fear":-2,"feared":-2,"fearful":-2,"fearing":-2,"fears":-2,
  "scared":-2,"scaring":-2,"scary":-2,
  "terrified":-3,"terrifying":-3,"terrify":-3,"terror":-3,
  "panic":-2,"panicked":-2,"panicking":-2,
  "anxious":-2,"anxiety":-2,"anxiously":-2,
  "dread":-2,"dreaded":-2,"dreading":-2,"dreads":-2,
  "depressed":-3,"depression":-3,"depressing":-3,
  "sad":-2,"sadness":-2,"sadly":-2,"sadden":-2,
  "cry":-2,"cried":-2,"crying":-2,
  "weep":-2,"wept":-2,"weeping":-2,
  "grief":-3,"grieve":-3,"grieving":-3,"grieved":-3,
  "mourn":-2,"mourning":-2,"mourned":-2,
  "sorrow":-2,"sorrowful":-2,"sorrowfully":-2,
  "pain":-2,"painful":-2,"painfully":-2,
  "ache":-2,"aching":-2,"aches":-2,
  "hurt":-2,"hurting":-2,"hurts":-2,"hurtful":-2,
  "suffer":-2,"suffering":-3,"suffered":-2,"suffers":-2,
  "misery":-3,"anguish":-3,"torment":-3,"tortured":-3,
  "agony":-3,"agonizing":-3,
  "helpless":-2,"hopeless":-3,"hopelessly":-3,
  "trapped":-2,"stuck":-2,"alone":-2,"lonely":-2,"loneliness":-2,
  "abandoned":-3,"abandon":-2,"neglect":-2,"neglected":-2,
  "rejected":-2,"rejection":-2,"reject":-2,
  "disappoint":-2,"disappointed":-2,"disappointing":-2,"disappointment":-2,
  "defeat":-2,"defeated":-2,
  "lose":-2,"losing":-2,"loss":-2,
  "regret":-2,"regretful":-2,"regrets":-2,
  "remorse":-2,"remorseful":-2,
  "embarrassed":-2,"embarrassing":-2,"embarrassment":-2,
  "humiliate":-3,"humiliated":-3,"humiliating":-3,"humiliation":-3,
  "shame":-2,"shameful":-2,"ashamed":-2,
  "guilt":-2,"guilty":-2,
  "jealous":-2,"jealousy":-2,
  "envy":-2,"envious":-2,
  "bitter":-2,"bitterly":-2,"bitterness":-2,
  "resentful":-2,"resentment":-2,"resent":-2,
  "betrayed":-3,"betrayal":-3,"betray":-3,
  "lied":-3,"lie":-3,"lying":-3,"lies":-3,"liar":-3,"liars":-3,
  "deceived":-3,"deceive":-3,"deceptive":-3,"deceit":-3,
  "manipulated":-3,"manipulate":-3,"manipulative":-3,"manipulation":-3,
  "gaslighted":-4,"gaslight":-4,
  "cheated":-3,"cheat":-3,"cheater":-3,"cheating":-3,
  "fraud":-3,"fraudulent":-3,"scammer":-3,
  "corrupt":-3,"corrupted":-3,"corruption":-3,
  "abuse":-3,"abused":-3,"abusive":-3,"abuser":-3,
  "violence":-3,"violent":-3,"violently":-3,
  "cruel":-3,"cruelty":-3,"cruelly":-3,
  "brutal":-3,"brutally":-3,"brutality":-3,
  "vicious":-3,"viciously":-3,
  "ruthless":-3,"ruthlessly":-3,
  "heartless":-3,"cold hearted":-3,"cold-hearted":-3,
  "toxic":-3,"poisonous":-3,
  "harmful":-3,"harm":-3,"damaging":-2,
  "destroy":-3,"destroyed":-3,"destroying":-3,
  "ruined":-3,"ruin":-3,"ruins":-2,
  "shattered":-3,"broken":-2,
  "dead":-2,"dying":-3,"die":-3,
  "death":-3,"deceased":-2,
  "worthless":-3,"useless":-3,"pointless":-2,
  "stupid":-2,"stupidity":-2,"stupidly":-2,
  "dumb":-2,"dumber":-2,"dumbest":-2,
  "ignorant":-2,"ignorance":-2,
  "incompetent":-2,"incompetence":-2,
  "irresponsible":-2,"reckless":-2,
  "careless":-2,"negligent":-2,
  "lazy":-2,"laziness":-2,
  "greedy":-2,"greed":-2,
  "selfish":-2,"selfishness":-2,
  "arrogant":-2,"arrogance":-2,
  "pompous":-2,"pretentious":-2,
  "condescending":-3,"rude":-3,"rudeness":-3,
  "disrespect":-2,"disrespectful":-2,
  "insult":-3,"insulted":-3,"insulting":-3,
  "offensive":-3,"offend":-2,"offended":-2,
  "mock":-2,"mocked":-2,"mocking":-2,"mockery":-2,
  "ridicule":-2,"ridiculous":-2,
  "humiliate":-3,"humiliation":-3,
  "wrong":-2,"wrongful":-2,"unfair":-2,"unjust":-2,
  "prejudice":-2,"prejudiced":-2,"biased":-2,
  "discriminate":-3,"discrimination":-3,
  "oppression":-3,"oppressive":-3,"oppress":-3,
  "exploit":-2,"exploited":-2,"exploiting":-2,
  "bad":-3,"badly":-3,"worse":-2,"worst":-3,
  "poor":-2,"poorly":-2,"inferior":-2,
  "cheap":-1,"fake":-2,
  "waste":-2,"wasted":-2,
  "meaningless":-2,"futile":-2,
  "problem":-1,"problematic":-2,
  "difficult":-2,"difficulty":-2,
  "struggle":-2,"struggled":-2,"struggling":-2,
  "annoyed":-2,"annoying":-2,"annoy":-2,"annoyance":-2,
  "frustrated":-2,"frustrating":-2,"frustration":-2,
  "irritated":-2,"irritating":-2,"irritation":-2,
  "bothered":-1,"nuisance":-2,"hassle":-2,
  "stressed":-2,"stress":-2,"stressful":-2,
  "nervous":-2,"worried":-2,"worry":-2,
  "exhausted":-2,"drained":-2,"burnt out":-2,
  "overwhelmed":-2,"overworked":-2,
  "tired":-1,"weary":-1,
  "doubt":-1,"skeptical":-1,"doubtful":-1,
  "uncertain":-1,"unsure":-1,"unclear":-1,
  "uncomfortable":-2,"uneasy":-1,
  "miss":-1,"missing":-1,"missed":-1,
  "cold":-1,"distant":-1,
  "nightmare":-3,"nightmarish":-3,
  "outrageous":-3,"outrage":-3,"outraged":-3,
  "infuriating":-3,"infuriated":-3,
  "enraging":-3,"enraged":-3,
  "maddening":-3,
  "unbearable":-3,"intolerable":-3,"insufferable":-3,
  "appalling":-3,"appalled":-3,
  "atrocious":-3,"atrociously":-3,"atrocity":-4,
  "abominable":-3,"abominate":-3,
  "wretched":-3,"miserable":-3,
  "horrible":-3,"horribly":-3,"horrifying":-3,"horrific":-3,
  "dreadful":-3,"awful":-3,"awfully":-3,"terrible":-3,"terribly":-3,
  "deplorable":-3,"despicable":-3,"detestable":-3,
  "abysmal":-3,
  "catastrophic":-4,
  "devastating":-3,

  // ── Strongly positive ──
  "love":3,"loved":3,"loves":3,"loving":3,
  "adore":3,"adored":3,"adores":3,"adoring":3,
  "amazing":4,"amazed":3,"amazingly":4,"amaze":4,
  "awesome":4,"awesomely":3,
  "incredible":4,"incredibly":4,
  "fantastic":4,"fantastically":4,
  "magnificent":3,"magnificently":3,
  "wonderful":4,"wonderfully":4,
  "brilliant":3,"brilliantly":3,
  "superb":3,"superbly":3,
  "outstanding":3,"outstandingly":3,
  "exceptional":3,"exceptionally":3,
  "excellent":3,"excellently":3,
  "perfect":3,"perfectly":3,
  "flawless":3,"flawlessly":3,
  "breathtaking":4,"breathtakingly":4,
  "stunning":3,"stunningly":3,
  "dazzling":3,"dazzlingly":3,
  "spectacular":3,"spectacularly":3,
  "extraordinary":3,"extraordinarily":3,
  "phenomenal":4,"phenomenally":4,
  "legendary":3,"epic":3,
  "glorious":3,"gloriously":3,"glory":3,
  "triumph":3,"triumphant":3,"triumphantly":3,
  "victory":3,"victorious":3,"victoriously":3,
  "win":2,"winning":2,"winner":2,"won":2,
  "best":3,"better":2,"great":3,"greatly":3,
  "good":3,"goodness":3,"good":3,
  "nice":2,"nicely":2,
  "beautiful":3,"beautifully":3,"beauty":3,
  "gorgeous":3,"gorgeously":3,
  "pretty":2,"adorable":3,"cute":2,"cutely":2,
  "charming":3,"delightful":3,"delightfully":3,"delight":3,"delighted":3,
  "pleasant":2,"pleasantly":2,"pleasure":2,
  "enjoy":3,"enjoyed":3,"enjoys":3,"enjoyable":3,"enjoyably":3,
  "happy":3,"happiness":3,"happily":3,"happier":2,"happiest":3,
  "joy":3,"joyful":3,"joyfully":3,"joyous":3,"joyously":3,
  "excited":3,"exciting":3,"excite":3,"excitement":3,
  "thrilled":3,"thrill":3,"thrilling":3,
  "ecstatic":4,"ecstatically":4,
  "elated":3,"elation":3,
  "bliss":3,"blissful":3,"blissfully":3,
  "content":2,"contented":2,"contentment":2,
  "satisfied":2,"satisfying":2,"satisfaction":2,
  "grateful":3,"gratitude":3,"thankful":3,"thankfully":3,
  "appreciate":2,"appreciated":2,"appreciative":2,"appreciation":2,
  "blessed":3,"blessing":3,"blessings":3,
  "fortunate":2,"lucky":2,"luck":2,
  "hope":2,"hopeful":2,"hopefully":2,
  "optimistic":2,"optimism":2,
  "inspired":3,"inspiring":3,"inspiration":3,"inspire":3,
  "motivated":2,"motivation":2,"motivate":2,
  "passionate":3,"passion":3,"passionately":3,
  "enthusiastic":3,"enthusiasm":3,"enthusiastically":3,
  "eager":2,"eagerly":2,"eagerness":2,
  "proud":2,"proudly":2,"pride":2,
  "confident":2,"confidently":2,"confidence":2,
  "brave":2,"bravely":2,"bravery":2,"courageous":2,"courage":2,
  "strong":2,"strength":2,"strongly":2,
  "resilient":2,"resilience":2,
  "achieve":2,"achieved":2,"achievement":2,
  "succeed":3,"succeeded":3,"success":3,"successful":3,"successfully":3,
  "accomplish":2,"accomplished":2,"accomplishment":2,
  "improve":2,"improved":2,"improvement":2,"improving":2,
  "progress":2,"progressing":2,
  "grow":2,"growth":2,"grew":2,
  "smart":2,"intelligent":2,"genius":3,"clever":2,
  "talented":2,"talent":2,"gifted":2,
  "creative":2,"creativity":2,"innovative":3,"innovation":3,
  "kind":2,"kindness":3,"kindly":2,
  "generous":2,"generosity":2,"generously":2,
  "caring":2,"care":2,"cares":2,"cared":2,
  "compassion":2,"compassionate":2,
  "empathy":2,"empathetic":2,
  "support":2,"supported":2,"supportive":2,
  "helpful":3,"help":2,"helped":2,"helping":2,
  "friendly":3,"friendliness":2,"friend":2,"friendship":2,
  "warm":2,"warmth":2,"warmly":2,
  "welcoming":2,"welcome":2,
  "trust":2,"trusted":2,"trustworthy":2,
  "honest":2,"honesty":2,"honorable":2,
  "loyal":2,"loyalty":2,
  "dedicated":2,"dedication":2,
  "committed":2,"commitment":2,
  "reliable":2,"dependable":2,
  "responsible":2,
  "fair":1,"fairness":1,"justice":2,
  "peaceful":2,"peace":2,"peacefully":2,
  "calm":2,"calmly":2,"calmness":2,
  "comfortable":2,"comfortably":2,"comfort":2,
  "safe":2,"safety":2,"secure":2,"security":2,
  "free":2,"freedom":2,
  "fun":3,"funny":2,"hilarious":3,"humor":2,
  "laugh":2,"laughing":2,"laughed":2,"laughter":3,
  "smile":2,"smiling":2,"smiled":2,"smiles":2,
  "cheerful":3,"cheerfully":3,"cheerfulness":3,
  "celebrate":3,"celebration":3,
  "fresh":2,"alive":2,"vibrant":2,"lively":2,
  "magnificent":3,"remarkable":3,"spectacular":3,
  "glad":3,"pleased":2,"positive":2,
  "productive":2,"effective":2,"efficient":2,
  "capable":2,"powerful":2,"energetic":2,
  "brave":2,"fearless":2,"bold":2,"boldly":2,
  "determined":2,"determination":2,
  "focused":2,"disciplined":2,
  "stable":1,"certain":1,
  "quality":2,"valuable":2,"worth":2,"worthwhile":2,"worthy":2,
  "useful":2,"helpful":3,

  // ── Internet slang positive ──
  "lol":2,"lmao":2,"rofl":3,"haha":2,"hehe":1,"lmfao":2,
  "lit":3,"fire":3,"goat":3,"based":2,"valid":2,
  "slaps":3,"banger":3,"bussin":3,"bussin bussin":4,
  "vibe":2,"vibes":2,"vibing":2,
  "hyped":3,"hype":2,
  "poggers":3,"pog":2,"w":2,"dub":2,"big w":3,
  "slay":3,"slaying":3,"slayed":3,"slayyy":3,
  "iconic":3,"legend":3,"goated":3,
  "lowkey":1,"highkey":2,
  "blessed":3,
  "clutch":2,
  "based":2,"redpilled":1,
  "pog":2,"hype":2,
  "absolutely":1,"totally":1,
  "fr":1,"fr fr":2,"no cap":2,"facts":2,
  "bet":1,"ight":1,"aight":1,
  "deadass":2,"periodt":2,"period":1,
  "ate":3,"ate that":3,"she ate":3,
  "understood the assignment":3,
  "main character":2,
  "rent free":1,
  "hits different":2,
  "sheesh":2,"sheeesh":3,
  "gg":2,"ez":1,"ggez":2,
  "op":2,"overpowered":2,
  "cracked":3,"goated":3,"insane":2,

  // ── Mild / neutral sentiment ──
  "ok":0,"okay":0,"fine":0,"alright":0,"sure":0,
  "whatever":0,"meh":-1,"blah":-1,
  "average":-1,"normal":0,"ordinary":0,
  "easy":1,"easily":1,
  "like":2,"liked":2,"likes":2,
  "dislike":-2,"dislikes":-2,
  "miss":-1,"missing":-1,
  "surprised":1,"shocking":-1,"shocked":-1,
  "interesting":1,"interesting":1,
  "knowledge":1,"learn":1,"learned":1,
  "imagine":1,
  "accept":1,"accept":1,
  "abundant":2,"advantage":2,"affordable":2,
  "clarity":2,"compelling":2,
  "genuine":2,"honest":2,
  "fresh":2,"alive":2,
  "important":2,
};

const NEGATORS = new Set([
  "not","no","never","none","neither","without","barely","hardly",
  "scarcely","seldom","cannot","can't","don't","doesn't","didn't",
  "isn't","wasn't","weren't","haven't","hasn't","hadn't","won't",
  "wouldn't","shouldn't","couldn't","nor","nothing","nobody","nowhere"
]);

const BOOSTERS = {
  "absolutely":0.293,"amazingly":0.293,"awfully":0.293,"completely":0.293,
  "considerably":0.293,"decidedly":0.293,"deeply":0.293,"enormously":0.293,
  "entirely":0.293,"especially":0.293,"exceptionally":0.293,
  "extremely":0.293,"fabulously":0.293,"flipping":0.293,"flippin":0.293,
  "fricking":0.293,"frickin":0.293,"frigging":0.293,"friggin":0.293,
  "fully":0.293,"greatly":0.293,"hella":0.293,"highly":0.293,
  "hugely":0.293,"incredibly":0.293,"intensely":0.293,"majorly":0.293,
  "more":0.293,"most":0.293,"particularly":0.293,"purely":0.293,
  "quite":0.293,"really":0.293,"remarkably":0.293,"so":0.293,
  "substantially":0.293,"thoroughly":0.293,"totally":0.293,
  "tremendously":0.293,"uber":0.293,"unbelievably":0.293,"unusually":0.293,
  "utterly":0.293,"very":0.293,
  "almost":-0.293,"barely":-0.293,"hardly":-0.293,"just enough":-0.293,
  "kind of":-0.293,"kinda":-0.293,"kindof":-0.293,"less":-0.293,
  "little":-0.293,"marginally":-0.293,"occasionally":-0.293,
  "partly":-0.293,"rather":-0.293,"scarcely":-0.293,"slightly":-0.293,
  "somewhat":-0.293,"sort of":-0.293
};

// ── Helpers ───────────────────────────────────────────────────────────────
function tokenize(text) {
    return text.match(/[a-zA-Z']+|[!?.]/g) || [];
}

function splitSentences(text) {
    return text.trim().split(/(?<=[.!?])\s+/).filter(s => s.trim());
}

function scoreSentence(tokens) {
    const sentiments = [];
    let negate = false;
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const lower = tok.toLowerCase().replace(/['']s$/, '');
        if (NEGATORS.has(lower)) { negate = true; continue; }
        const booster = BOOSTERS[lower];
        const base = LEXICON[lower];
        if (base !== undefined) {
            let val = base;
            // apply booster from previous word
            if (i > 0 && BOOSTERS[tokens[i-1].toLowerCase()] !== undefined) {
                val += val * Math.abs(BOOSTERS[tokens[i-1].toLowerCase()]);
            }
            if (negate) val *= -0.74;
            sentiments.push(val);
            negate = false;
        } else if (/^[!]+$/.test(tok)) {
            // exclamation marks boost
            const boost = Math.min(tok.length, 3) * 0.292;
            if (sentiments.length) sentiments[sentiments.length - 1] += boost * Math.sign(sentiments[sentiments.length - 1] || 1);
        } else {
            negate = false;
        }
    }
    return sentiments;
}

function calcCompound(sentiments) {
    if (!sentiments.length) return 0;
    const sum = sentiments.reduce((a, b) => a + b, 0);
    const alpha = 15;
    return sum / Math.sqrt(sum * sum + alpha);
}

function sentimentScores(text) {
    const tokens = tokenize(text);
    const sentiments = scoreSentence(tokens);
    const compound = calcCompound(sentiments);
    const pos = sentiments.filter(s => s > 0).reduce((a, b) => a + b, 0);
    const neg = sentiments.filter(s => s < 0).reduce((a, b) => a + Math.abs(b), 0);
    const total = pos + neg + 0.000001;
    return {
        pos: Math.round(pos / total * 100 * 10) / 10,
        neg: Math.round(neg / total * 100 * 10) / 10,
        neu: Math.round(Math.max(0, 100 - pos / total * 100 - neg / total * 100) * 10) / 10,
        compound: Math.round(compound * 10000) / 10000
    };
}

function classify(compound) {
    if (compound >= 0.05) return 'positive';
    if (compound <= -0.05) return 'negative';
    return 'neutral';
}

function intensity(compound) {
    const a = Math.abs(compound);
    if (a >= 0.75) return 'strong';
    if (a >= 0.35) return 'moderate';
    if (a >= 0.05) return 'mild';
    return 'neutral';
}

function tokenBreakdown(text) {
    const raw = tokenize(text);
    const result = [];
    let negate = false;
    for (const tok of raw) {
        const lower = tok.toLowerCase().replace(/['']s$/, '');
        if (NEGATORS.has(lower)) {
            result.push({ word: tok, score: 0, label: 'negator' });
            negate = true;
            continue;
        }
        const base = LEXICON[lower];
        if (base !== undefined) {
            const effective = negate ? base * -0.74 : base;
            result.push({
                word: tok,
                score: Math.round(effective * 100) / 100,
                label: effective > 0.5 ? 'positive' : effective < -0.5 ? 'negative' : 'weak'
            });
            negate = false;
        } else {
            result.push({ word: tok, score: 0, label: 'neutral' });
            if (!/^[!?.]+$/.test(tok)) negate = false;
        }
    }
    return result;
}

function analyze(text) {
    const doc = sentimentScores(text);
    const sentences = splitSentences(text).map(s => {
        const sc = sentimentScores(s);
        return { text: s, compound: sc.compound, pos: sc.pos, neg: sc.neg, neu: sc.neu, label: classify(sc.compound) };
    });
    const tokens = tokenBreakdown(text);
    const scored = tokens.filter(t => !['neutral','negator'].includes(t.label));
    const wordToks = tokens.filter(t => /[a-zA-Z]/.test(t.word));
    const subjectivity = Math.round(scored.length / Math.max(wordToks.length, 1) * 100 * 10) / 10;
    return {
        overall: {
            positive: doc.pos, negative: doc.neg, neutral: doc.neu,
            compound: doc.compound,
            label: classify(doc.compound),
            intensity: intensity(doc.compound),
            subjectivity
        },
        sentences,
        tokens
    };
}

// ── Render results ────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderSentimentResults(data) {
    const o = data.overall;
    document.getElementById('sent-results').style.display = 'block';

    setTimeout(() => {
        document.getElementById('sent-pos-fill').style.width = o.positive + '%';
        document.getElementById('sent-neg-fill').style.width = o.negative + '%';
        document.getElementById('sent-neu-fill').style.width = o.neutral  + '%';
    }, 60);
    document.getElementById('sent-pos-pct').textContent = o.positive + '%';
    document.getElementById('sent-neg-pct').textContent = o.negative + '%';
    document.getElementById('sent-neu-pct').textContent = o.neutral  + '%';

    const compoundEl = document.getElementById('sent-compound');
    compoundEl.textContent = (o.compound >= 0 ? '+' : '') + o.compound;
    compoundEl.style.color = o.compound >= 0.05 ? 'var(--c)' : o.compound <= -0.05 ? 'var(--m)' : 'var(--muted)';
    document.getElementById('sent-intensity').textContent    = o.intensity.toUpperCase();
    document.getElementById('sent-subjectivity').textContent = o.subjectivity + '%';

    const verd = document.getElementById('sent-verdict');
    const icons = { positive: '\u2b06', negative: '\u2b07', neutral: '\u25cf' };
    verd.textContent = icons[o.label] + ' ' + o.label.toUpperCase() + '  —  ' + o.intensity.toUpperCase() + ' SIGNAL';
    verd.className = 'sent-verdict ' + (o.label === 'positive' ? 'pos' : o.label === 'negative' ? 'neg' : 'neu');

    const sentBox = document.getElementById('sent-sentences');
    sentBox.innerHTML = data.sentences.map(s => {
        const sign = s.compound >= 0 ? '+' : '';
        return `<div class="sent-sentence-card ${s.label}">
            <span class="sc-text">${escHtml(s.text)}</span>
            <span class="sc-score">${sign}${s.compound} · ${s.label}</span>
        </div>`;
    }).join('');

    const tokBox = document.getElementById('sent-tokens');
    tokBox.innerHTML = data.tokens.map(t => {
        const cls = 'tok-' + t.label;
        const title = t.score !== 0 ? `title="score: ${t.score}"` : '';
        return `<span class="${cls}" ${title}>${escHtml(t.word)}</span>`;
    }).join(' ');
}

// ── UI bindings ───────────────────────────────────────────────────────────
window.analyzeSentiment = function() {
    const text = document.getElementById('sent-input').value.trim();
    if (!text) return;
    const btn = document.getElementById('sent-btn');
    btn.classList.add('loading');
    btn.textContent = 'Scanning…';
    // yield one frame so button updates visually
    setTimeout(() => {
        try {
            const data = analyze(text);
            renderSentimentResults(data);
        } catch(e) {
            console.error('Sentiment error:', e);
        }
        btn.classList.remove('loading');
        btn.textContent = 'Analyze';
    }, 20);
};

// Auto-analyze on input after short debounce
let _sentDebounce;
document.getElementById('sent-input').addEventListener('input', () => {
    clearTimeout(_sentDebounce);
    _sentDebounce = setTimeout(() => {
        const text = document.getElementById('sent-input').value.trim();
        if (text.length > 5) window.analyzeSentiment();
    }, 400);
});

})(); // end sentiment IIFE