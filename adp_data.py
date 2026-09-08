# Baked offline fallback for the ADP board. Only reached when Sleeper's feed is down,
# because Sleeper defines who is even on the board.
#
# Regenerated 2026-09-08 from the live feeds, ordered by Sleeper adp_ppr and cut at 216 to
# match the live board's depth exactly. Sleeper positions are filtered to the league's
# (QB/RB/WR/TE/K/DST) - its raw list also carries DB/FB/LB/DL/P, which would otherwise
# land on the board.
#
# One row per player instead of the four index-aligned strings this used to be
# (ROWS / ID_RANK / TOKENS / ESPN_LIVE). Those had to be extended in lockstep and a
# single misalignment corrupted the fallback silently.
#
# espn_id is only used to build the headshot URL. 1 of 216 have no ESPN match, so no
# id, no ESPN ADP, and the <img> onerror hides the broken image.
#
# name, pos, team, espn_id, sleeper_adp, sleeper_pr, espn_adp, espn_pr, yahoo_adp, yahoo_pr
SNAPSHOT = [
("Jahmyr Gibbs","RB","DET",4429795,1.3,1,1.3,1,1.3,1),
("Bijan Robinson","RB","ATL",4430807,2,2,2.4,2,2,2),
("Ja'Marr Chase","WR","CIN",4362628,3.4,1,4.2,1,3.5,1),
("Puka Nacua","WR","LAR",4426515,4.2,2,5.3,2,5,2),
("Christian McCaffrey","RB","SF",3117251,5,3,7.7,4,6.1,4),
("Jaxon Smith-Njigba","WR","SEA",4430878,6.2,3,6.4,3,7.4,3),
("Jonathan Taylor","RB","IND",4242335,7,4,6.2,3,6,3),
("Amon-Ra St. Brown","WR","DET",4374302,8.2,4,8.5,4,7.9,4),
("James Cook","RB","BUF",4379399,8.9,5,10.1,5,9.3,5),
("CeeDee Lamb","WR","DAL",4241389,10.2,5,11.6,5,11.4,5),
("Justin Jefferson","WR","MIN",4262921,11.9,6,12.4,6,13.4,6),
("Saquon Barkley","RB","PHI",3929630,12.6,6,14.1,7,11.1,6),
("De'Von Achane","RB","MIA",4429160,13.5,7,13.2,6,15.5,9),
("Chase Brown","RB","CIN",4362238,14,8,17.8,10,15.5,8),
("Omarion Hampton","RB","LAC",4685382,15.3,9,17.8,9,18,11),
("Ashton Jeanty","RB","LV",4890973,16,10,21.6,11,18.7,12),
("A.J. Brown","WR","NE",4047646,17.3,7,21.4,8,23.9,10),
("Derrick Henry","RB","BAL",3043078,17.5,11,16.5,8,16.8,10),
("Kenneth Walker","RB","KC",4567048,19.8,12,24.4,12,14.7,7),
("Drake London","WR","ATL",4426502,20.9,8,20.7,7,20.5,7),
("Josh Allen","QB","BUF",3918298,21.6,1,19,1,21.2,1),
("George Pickens","WR","DAL",4426354,22.9,9,28.3,10,22.5,9),
("Brock Bowers","TE","LV",4432665,23.3,1,23.9,2,20.9,1),
("Nico Collins","WR","HOU",4258173,24.1,10,25.9,9,21.2,8),
("Trey McBride","TE","ARI",4361307,25.3,2,23.4,1,28.1,2),
("Malik Nabers","WR","NYG",4595348,26.1,11,35.8,13,30,12),
("Kyren Williams","RB","LAR",4430737,26.3,13,34.6,15,27.7,13),
("Jeremiyah Love","RB","ARI",4870808,28.9,14,25.4,13,29.9,14),
("Rashee Rice","WR","KC",4428331,29.8,12,29.3,11,36.6,16),
("Chris Olave","WR","NO",4361370,30.6,13,29.7,12,30.4,13),
("Lamar Jackson","QB","BAL",3916387,31.3,2,33.4,2,39,2),
("Javonte Williams","RB","DAL",4361579,32.3,15,32.5,14,32.6,15),
("DeVonta Smith","WR","PHI",4241478,33.3,14,36.2,14,29.4,11),
("Breece Hall","RB","NYJ",4427366,34.3,16,35.9,16,34.4,16),
("Tee Higgins","WR","CIN",4239993,35.3,15,52.9,21,33.8,14),
("Ladd McConkey","WR","LAC",4612826,35.4,16,46.3,20,44.5,19),
("Tetairoa McMillan","WR","CAR",4685472,37.2,17,43,16,41.8,18),
("Emeka Egbuka","WR","TB",4567750,38.6,18,45.4,18,46.3,20),
("Colston Loveland","TE","CHI",4723086,39.5,3,42.2,3,39.2,3),
("Cam Skattebo","RB","NYG",4696981,40.1,17,45.1,18,42.5,18),
("Zay Flowers","WR","BAL",4429615,41.2,19,43.9,17,35.5,15),
("Bucky Irving","RB","TB",4596448,42.6,18,56.5,21,53.1,20),
("Travis Etienne","RB","NO",4239996,43.3,19,39.4,17,41.4,17),
("Jaylen Waddle","WR","DEN",4372016,44.7,20,53.3,22,39.2,17),
("Garrett Wilson","WR","NYJ",4569618,44.9,21,37.1,15,46.5,21),
("Josh Jacobs","RB","GB",4047365,46.9,20,100.8,31,59.1,23),
("David Montgomery","RB","HOU",4035538,47.7,21,61.9,22,53.1,21),
("Drake Maye","QB","NE",4431452,48.6,3,46.6,3,48,3),
("Tyler Warren","TE","IND",4431459,49.9,4,51.5,4,46.8,4),
("Davante Adams","WR","LAR",16800,50.5,22,46.1,19,57.9,25),
("D'Andre Swift","RB","CHI",4259545,51.6,22,52.8,20,45.2,19),
("Joe Burrow","QB","CIN",3915511,52.7,4,53,5,50.8,4),
("DJ Moore","WR","BUF",3915416,53.3,23,58.5,23,57.8,24),
("Quinshon Judkins","RB","CLE",4685702,53.3,23,47.8,19,54.5,22),
("Terry McLaurin","WR","WAS",3121422,55.4,24,61.1,24,54.8,22),
("Luther Burden","WR","CHI",4685278,56.9,25,75,27,57.1,23),
("Sam LaPorta","TE","DET",4430027,57.7,5,75.2,8,63,6),
("Jalen Hurts","QB","PHI",4040715,58.2,5,54.3,6,55.5,5),
("TreVeyon Henderson","RB","NE",4432710,59.2,24,77.3,26,68.4,26),
("Jameson Williams","WR","DET",4426388,60.5,26,64.6,25,65,26),
("Bhayshul Tuten","RB","JAX",4882093,61.1,25,62.1,23,61.5,24),
("Jadarian Price","RB","SEA",4685512,62.1,26,66.1,24,63.1,25),
("Mike Evans","WR","SF",16737,62.8,27,83.8,31,70.5,29),
("Tucker Kraft","TE","GB",4572680,64.5,6,91.3,9,59.8,5),
("Rome Odunze","WR","CHI",4431299,65.8,28,67.7,26,66.9,27),
("Jayden Daniels","QB","WAS",4426348,66.1,6,52.6,4,56.4,6),
("Kyle Pitts","TE","ATL",4360248,67.4,7,68.8,5,71.7,8),
("Christian Watson","WR","GB",4248528,68.6,29,88.9,33,67.7,28),
("Carnell Tate","WR","TEN",4871023,69.8,30,80.9,29,82.3,32),
("Caleb Williams","QB","CHI",4431611,70.1,7,85.3,9,66,7),
("Jaylen Warren","RB","PIT",4569987,71.7,27,85.6,27,75.7,27),
("Harold Fannin","TE","CLE",5083076,71.8,8,70.8,7,70.3,7),
("Parker Washington","WR","JAX",4432620,73.4,31,90.5,34,75.8,30),
("Brian Thomas","WR","JAX",4432773,74.4,32,113.6,40,83.8,33),
("DK Metcalf","WR","PIT",4047650,75.5,33,86.1,32,85.2,34),
("Marvin Harrison","WR","ARI",4432708,76.4,34,79.7,28,78.1,31),
("Dak Prescott","QB","DAL",2577417,77.5,8,72,7,73.1,9),
("Rhamondre Stevenson","RB","NE",4569173,78.9,28,77.2,25,75.8,28),
("Chuba Hubbard","RB","CAR",4241416,79.7,29,112,35,90.9,33),
("RJ Harvey","RB","DEN",4568490,80.2,30,128.7,39,110.2,37),
("Courtland Sutton","WR","DEN",3128429,80.8,35,82.2,30,107.6,42),
("George Kittle","TE","SF",3040151,82,9,69.3,6,81.3,9),
("Justin Herbert","QB","LAC",4038941,83.1,9,85.7,10,70.1,8),
("Tony Pollard","RB","TEN",3916148,84.4,31,86.3,28,86.1,29),
("Rams","DST","LAR",-16014,85.8,1,97.2,2,87.1,1),
("Rico Dowdle","RB","PIT",4038815,86.1,32,97.2,29,86.9,30),
("Michael Wilson","WR","ARI",4360761,87.1,36,105.3,37,100.5,37),
("Dalton Kincaid","TE","BUF",4385690,88.9,10,131.9,15,96.5,11),
("Brandon Aubrey","K","DAL",3953687,89.4,1,80.9,1,88.3,1),
("Travis Kelce","TE","KC",15847,89.9,11,94,10,95.1,10),
("Makai Lemon","WR","PHI",4870795,91.3,37,135.3,48,118.8,46),
("J.K. Dobbins","RB","DEN",4241985,92.7,33,111.8,34,94.2,34),
("Chris Godwin","WR","TB",3116165,93.1,38,124.7,45,94.4,35),
("Matthew Stafford","QB","LAR",12483,94.1,10,93.2,11,99.3,14),
("Texans","DST","HOU",-16034,95.6,2,92.3,1,95.1,2),
("Jaxson Dart","QB","NYG",4689114,96.9,11,82.3,8,94.1,11),
("Alec Pierce","WR","IND",4360078,97.3,39,105.6,38,96.7,36),
("Jake Ferguson","TE","DAL",4242355,98.5,12,114.8,12,117.5,15),
("Jonathon Brooks","RB","CAR",4678008,98.9,34,104.9,33,90.2,32),
("Blake Corum","RB","LAR",4429096,100.3,35,127.5,38,99.5,35),
("Jordan Addison","WR","MIN",4429205,101.6,40,124.4,44,115,45),
("Trevor Lawrence","QB","JAX",4360310,102.1,12,104,12,82.5,10),
("Seahawks","DST","SEA",-16026,103.5,3,112.9,4,110.1,4),
("Michael Pittman","WR","PIT",4035687,104.8,41,90.6,35,121.5,48),
("Kyle Monangai","RB","CHI",4608686,105,36,125.4,37,111.9,39),
("Isaiah Likely","TE","NYG",4361050,106.9,13,122.5,13,109.3,13),
("Stefon Diggs","WR","WAS",2976212,107.3,42,104.1,36,106.3,40),
("Jayden Reed","WR","GB",4362249,107.5,43,139.8,52,114.4,44),
("Jordan Mason","RB","MIN",4360569,109.1,37,140.7,42,111,38),
("Patrick Mahomes","QB","KC",3139477,110.5,13,109.4,15,105,15),
("Kenny Gainwell","RB","TB",4371733,111.7,38,100.1,30,120.7,41),
("Quentin Johnston","WR","LAC",4429025,112.6,44,135.1,47,107,41),
("Jordyn Tyson","WR","NO",4880281,113.9,45,168.1,61,104,38),
("Josh Downs","WR","IND",4688813,114.1,46,137.8,49,104.5,39),
("Jacory Croskey-Merritt","RB","WAS",4575131,115.6,39,137.5,41,105.4,36),
("Bo Nix","QB","DEN",4426338,116.4,14,104.3,13,98.4,13),
("Broncos","DST","DEN",-16007,116.6,4,98.1,3,103.5,3),
("Cameron Dicker","K","LAC",4362081,118.1,2,109.4,2,124.4,4),
("Dallas Goedert","TE","PHI",3121023,119.9,14,101.4,11,104.5,12),
("KC Concepcion","WR","CLE",4870653,120,47,148.6,55,122.3,49),
("Wan'Dale Robinson","WR","TEN",4569587,121.2,48,111.4,39,130.6,61),
("Brock Purdy","QB","SF",4361741,122.8,15,109.3,14,98.2,12),
("Eagles","DST","PHI",-16021,123.6,5,137.6,7,124.3,5),
("Jason Myers","K","SEA",2473037,124.9,3,112.6,3,122.4,3),
("Matthew Golden","WR","GB",4701936,125.2,49,115.3,41,124.9,52),
("Mark Andrews","TE","BAL",3116365,125.6,15,126.5,14,113.5,14),
("Aaron Jones","RB","MIN",3042519,127.7,40,117.1,36,124.7,44),
("Ka'imi Fairbairn","K","HOU",2971573,128.7,4,122.7,4,119.1,2),
("Jakobi Meyers","WR","JAX",3916433,129.9,50,121.5,43,130.8,63),
("Deebo Samuel","WR","SF",3126486,130.6,51,145,53,127.2,56),
("Jared Goff","QB","DET",3046779,131.2,16,137.6,17,112.5,16),
("Romeo Doubs","WR","NE",4361432,132.1,52,148.6,54,132.2,65),
("Cam Little","K","JAX",4686361,133.5,5,140.6,6,131,8),
("Rachaad White","RB","WAS",4697815,134.3,41,129.3,40,124.9,45),
("Xavier Worthy","WR","KC",4683062,135,53,133.1,46,129.1,60),
("Ravens","DST","BAL",-16033,136,6,133.9,6,137,17),
("Patriots","DST","NE",-16017,137,7,154,8,131.1,10),
("MarShawn Lloyd","RB","GB",4429023,138,42,102.9,32,87.1,31),
("De'Zhaun Stribling","WR","SF",4710714,139.4,54,138,50,108.1,43),
("Mike Washington","RB","LV",4686658,140.8,43,162.9,47,123.8,42),
("Chris Rodriguez","RB","JAX",4362619,141.5,44,164.7,50,130.4,54),
("Hunter Henry","TE","NE",3046439,142.4,16,153,16,127.5,24),
("Baker Mayfield","QB","TB",3052587,143.2,17,147.7,18,125.5,25),
("Tyler Allgeier","RB","ARI",4373626,143.7,45,164,49,129.8,53),
("Khalil Shakir","WR","BUF",4373678,145.1,55,138.3,51,130.6,62),
("Jake Bates","K","DET",4689936,146.9,6,156.3,9,137.7,12),
("Woody Marks","RB","HOU",4429059,147.7,46,152.5,44,130.6,56),
("Jalen Coker","WR","CAR",4695883,148.8,56,154.7,56,133.3,66),
("Rashid Shaheed","WR","SEA",4032473,149.1,57,160.5,57,128.3,57),
("Oronde Gadsden","TE","LAC",4595342,150.9,17,170.3,58,126.4,22),
("Kyler Murray","QB","MIN",3917315,151.2,18,136.9,16,113.2,17),
("Chris Boswell","K","PIT",17372,152.2,7,164.7,10,132.6,10),
("Zach Charbonnet","RB","SEA",4426385,152.5,47,156,45,131,57),
("Steelers","DST","PIT",-16023,154.1,8,121.7,5,137.5,18),
("Vikings","DST","MIN",-16016,155.8,9,168.9,15,132.4,13),
("Harrison Mevis","K","LAR",4574716,156.4,8,129.4,5,131.6,9),
("Jaguars","DST","JAX",-16030,157.4,10,167.4,13,138.2,19),
("Lions","DST","DET",-16008,158,11,155.3,9,136.4,16),
("Harrison Butker","K","KC",3055899,159.4,9,143.9,8,129,6),
("Ja'Kobi Lane","WR","BAL",4870847,160,58,169.1,64,126.9,55),
("Brenton Strange","TE","JAX",4430539,161.8,18,168.6,21,129.7,26),
("Jordan Love","QB","GB",4036378,161.9,19,155.5,20,121.8,21),
("Sam Darnold","QB","SEA",3912547,163.9,20,162.7,22,122.2,22),
("T.J. Hockenson","TE","MIN",4036133,164.1,19,154.2,17,127.8,25),
("Tyjae Spears","RB","TEN",4428557,165.6,48,151.4,43,132.1,59),
("Jonah Coleman","RB","DEN",4702555,166.5,49,162.9,46,128.6,50),
("Alvin Kamara","RB","NO",3054850,167.2,50,163.6,48,125.6,47),
("Chargers","DST","LAC",-16024,169.8,12,165.1,11,139.4,20),
("Will Reichard","K","MIN",4567104,170.4,10,167.8,12,142.7,17),
("Denzel Boston","WR","CLE",4832800,170.9,59,169,63,131.1,64),
("Brian Robinson","RB","ATL",4241474,172.1,51,167.9,52,117.6,40),
("Kenyon Sadiq","TE","NYJ",5083315,173.1,20,166.7,19,130.1,27),
("Tyrone Tracy","RB","NYG",4360516,174.2,52,170.3,86,130.5,55),
("Malik Washington","WR","MIA",4569603,175.6,60,169.9,70,None,None),
("Tyler Loop","K","BAL",4697745,176.5,11,165.6,11,139.4,14),
("Juwan Johnson","TE","NO",3929645,177.8,21,157.3,18,121.5,16),
("Cyrus Allen","WR","KC",4912218,178.6,61,169.8,68,None,None),
("Dalton Schultz","TE","HOU",3117256,179.5,22,168.8,22,125.3,20),
("Evan McPherson","K","CIN",4360234,179.7,12,169.2,16,142.4,15),
("Tank Bigsby","RB","PHI",4429013,181,53,169.7,54,129,51),
("Jalen Nailor","WR","LV",4382466,182.9,62,171.2,119,128.5,59),
("Tyler Shough","QB","NO",4360689,183.1,21,152.7,19,130,28),
("Keaton Mitchell","RB","LAC",4596334,184.6,54,169.4,53,131.4,58),
("Fernando Mendoza","QB","LV",4837248,185,22,168.8,26,117.6,19),
("Jerry Jeudy","WR","CLE",4241463,186.3,63,168.8,62,None,None),
("AJ Barner","TE","SEA",4576297,187.5,23,169.7,24,125.1,19),
("Eddy Pineiro","K","SF",4034949,188.1,13,142.9,7,142.7,18),
("Dylan Sampson","RB","CLE",5081397,188.4,55,169.8,55,None,None),
("Tank Dell","WR","HOU",4366031,190.9,64,165.1,59,None,None),
("Chig Okonkwo","TE","WAS",4360635,191.7,24,170.1,51,126.5,23),
("Isiah Pacheco","RB","DET",4361529,192.8,56,166.4,51,124.9,46),
("Omar Cooper","WR","NYJ",4723820,193.5,65,171.1,118,None,None),
("Andy Borregales","K","NE",4569923,194.5,14,170.1,30,142.6,16),
("Kaelon Black","RB","SF",4696044,195.1,57,170,57,129.7,52),
("Trey Smack","K","GB",4869461,196.7,15,168.3,13,130.5,7),
("Kayshon Boutte","WR","HOU",4429022,197.8,66,170.5,105,125.8,54),
("Cooper Kupp","WR","SEA",2977187,198,67,169.3,65,119.7,47),
("Caleb Douglas","WR","MIA",4869645,199,68,170.9,112,None,None),
("Cowboys","DST","DAL",-16006,200.7,13,167.4,14,134.8,14),
("Keenan Allen","WR","IND",15818,201.3,69,165.7,60,125.4,53),
("Daniel Jones","QB","IND",3917792,202.1,23,161.1,21,127.3,27),
("Tre Tucker","WR","LV",4428718,203,70,169.5,66,128.5,58),
("C.J. Stroud","QB","HOU",4432577,204.5,24,165.4,23,125.6,26),
("Packers","DST","GB",-16009,205.6,14,169.6,19,135.7,15),
("Emmett Johnson","RB","KC",4832955,206.5,58,169.9,56,126.2,48),
("Terrance Ferguson","TE","LAR",4570037,206.9,25,168,20,125.7,21),
("Braelon Allen","RB","NYJ",4685247,208,59,171,100,126.6,49),
("Malik Willis","QB","MIA",4242512,209,25,167.5,24,124.8,24),
("Jalen McMillan","WR","TB",4430834,210.6,71,163.5,58,None,None),
("Zachariah Branch","WR","ATL",4870612,211.3,72,170.7,110,None,None),
("Devin Neal","RB","",None,211.9,60,None,None,None,None),
("Jauan Jennings","WR","MIN",3886598,212.3,73,171.1,116,None,None),
("49ers","DST","SF",-16025,213.2,15,169.1,17,125.6,6),
("Jaylin Noel","WR","HOU",4586312,213.7,74,171.6,124,None,None),
("Kaleb Johnson","RB","GB",4819231,214.2,61,170.1,66,None,None),
("Jake Elliott","K","PHI",3050478,215.1,16,169.1,15,127.4,5),
]

WINKS = """Jahmyr Gibbs;Ja'Marr Chase;Puka Nacua;Bijan Robinson;Jaxon Smith-Njigba;Amon-Ra St. Brown;Christian McCaffrey;CeeDee Lamb;Jonathan Taylor;Justin Jefferson;De'Von Achane;Kenneth Walker III;Chase Brown;Saquon Barkley;James Cook III;Derrick Henry;Nico Collins;Brock Bowers;Malik Nabers;Drake London;A.J. Brown;George Pickens;Omarion Hampton;Ashton Jeanty;Chris Olave;Jaylen Waddle;Trey McBride;Zay Flowers;DeVonta Smith;Tetairoa McMillan;Garrett Wilson;Tee Higgins;Jeremiyah Love;Breece Hall;Rashee Rice;Ladd McConkey;Emeka Egbuka;Colston Loveland;Travis Etienne Jr.;Javonte Williams;Kyren Williams;Josh Jacobs;Josh Allen;Rome Odunze;Parker Washington;DJ Moore;Luther Burden III;D'Andre Swift;Cam Skattebo;Christian Watson;Jameson Williams;Tyler Warren;Terry McLaurin;Mike Evans;Davante Adams;Bhayshul Tuten;Quinshon Judkins;Jadarian Price;Bucky Irving;David Montgomery;Lamar Jackson;Sam LaPorta;Rhamondre Stevenson;TreVeyon Henderson;Jaylen Warren;Harold Fannin Jr.;Jalen Hurts;Joe Burrow;Drake Maye;Kyle Pitts Sr.;Tucker Kraft;Jayden Daniels;Marvin Harrison Jr.;KC Concepcion;Matthew Golden;Jordan Addison;Makai Lemon;DK Metcalf;Brian Thomas Jr.;Josh Downs;Chuba Hubbard;Caleb Williams;Dak Prescott;Carnell Tate;Jayden Reed;Quentin Johnston;Courtland Sutton;Chris Godwin Jr.;Dalton Kincaid;J.K. Dobbins;Tony Pollard;Jacory Croskey-Merritt;Alec Pierce;Michael Wilson;Stefon Diggs;Wan'Dale Robinson;George Kittle;Dallas Goedert;Jonathon Brooks;Aaron Jones Sr.;Rico Dowdle;Justin Herbert;De'Zhaun Stribling;Michael Pittman Jr.;Jalen Coker;Romeo Doubs;Xavier Worthy;Isaiah Likely;Travis Kelce;Juwan Johnson;Keaton Mitchell;Rachaad White;Blake Corum;Bo Nix;Trevor Lawrence;Kyler Murray;Matthew Stafford;Brock Purdy;Jaxson Dart;Jordan Mason;Kyle Monangai;Keenan Allen;Jordyn Tyson;Khalil Shakir;Rashid Shaheed;Chris Rodriguez Jr.;RJ Harvey;Ka'imi Fairbairn;Brandon Aubrey;Jordan Love;Jared Goff;Woody Marks;Jake Ferguson;Mark Andrews;Jakobi Meyers;Denzel Boston;Travis Hunter;Kenny Gainwell;Zach Charbonnet;Mike Washington Jr.;Baker Mayfield;Patrick Mahomes II;Houston Texans;Los Angeles Rams;Philadelphia Eagles;Cameron Dicker;Jason Myers;Seattle Seahawks;Denver Broncos;Jacksonville Jaguars;Tre Tucker;Ja'Kobi Lane;Dalton Schultz;Malik Willis;Cam Little;Tyler Loop;Minnesota Vikings;Pittsburgh Steelers;Baltimore Ravens;New England Patriots;Tank Bigsby;Ray Davis;MarShawn Lloyd;Tyjae Spears;Terrance Ferguson;Jalen McMillan;Kayshon Boutte;Dontayvion Wicks;Pat Bryant;Will Reichard;Cairo Santos;Evan McPherson;Eddy Pineiro;Wil Lutz;Chig Okonkwo;Brenton Strange;AJ Barner;Adonai Mitchell;Omar Cooper Jr.;Deebo Samuel Sr.;Ryan Flournoy;Tre' Harris;Tyler Allgeier;Emmett Johnson;Malachi Fields;Chris Bell;Kenyon Sadiq;Hunter Henry;Dallas Cowboys;Los Angeles Chargers;Green Bay Packers;Jake Bates;Harrison Mevis;Chase McLaughlin;Trey Smack;Chris Boswell;Andy Borregales;Harrison Butker;Brian Robinson Jr.;Jonah Coleman;Braelon Allen;Dylan Sampson;Jaydon Blue;Jalen Nailor;Caleb Douglas;Devaughn Vele;Tyler Shough;Sam Darnold;C.J. Stroud;Daniel Jones;Fernando Mendoza;Greg Dulcich;Darren Waller;T.J. Hockenson;Colby Parkinson;Pat Freiermuth;Cade Otton;Bryce Young;Geno Smith;Cyrus Allen;Jerry Jeudy;Keon Coleman;Jauan Jennings;Germie Bernard;Alvin Kamara;Kaelon Black;Seth McGowan;Samaje Perine;Najee Harris;Kansas City Chiefs;Cincinnati Bengals;Tampa Bay Buccaneers;New York Giants;San Francisco 49ers;Charlie Kolar;Evan Engram;Jake Elliott;Blake Grupe;Cleveland Browns;Tennessee Titans;Buffalo Bills;Cam Ward;Aaron Rodgers;Jacoby Brissett;Shedeur Sanders;Calvin Ridley;Rashod Bateman;Cooper Kupp;Treylon Burks;Jaylin Noel;Sean Tucker;Isiah Pacheco;Justice Hill;Charlie Smyth;Tyler Bass;Nick Folk;New Orleans Saints;Indianapolis Colts;Zane Gonzalez;Ryan Fitzgerald;Spencer Shrader;Ben Sauls;Detroit Lions;Deshaun Watson;Tua Tagovailoa;Mason Taylor;Erick All Jr.;Oronde Gadsden II;Andrei Iosivas;Jahan Dotson;Zachariah Branch;Malik Washington;Kaytron Allen;Tyrone Tracy Jr.;DJ Giddens;Kimani Vidal;James Conner;Kirk Cousins;New York Jets;Las Vegas Raiders;Gunnar Helm;Michael Mayer;Darnell Washington;Darius Slayton;Tyquan Thornton;Isaac TeSlaa;Xavier Hutchinson;Tank Dell;Isaiah Davis;Jordan James;LeQuint Allen Jr.;George Holani;Ollie Gordon II;Emari Demercado;Jack Bech;Ted Hurst III;Luke McCaffrey;Emanuel Wilson;DeMario Douglas;Kyle Williams"""
