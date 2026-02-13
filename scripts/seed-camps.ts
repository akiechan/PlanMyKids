import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CampData {
  name: string;
  description: string;
  location: string;
  ageRange: string;
  dates: string;
  hours: string;
  pricing: string;
  website: string;
}

// All camps from the CSV
const camps: CampData[] = [
  {
    name: "4ft and Up Kitchen",
    description: "In our camp, your young chef will be taught different baking and decorating techniques and explore the world via their taste buds. They will discover the origins of the dishes they prepare and look at math in a new and fun way, acquiring a knowledge of the science that ties into the culinary arts.",
    location: "Pacific Heights",
    ageRange: "Age 4 - 12",
    dates: "June 15 - August 21",
    hours: "9:00am - 3:15pm",
    pricing: "$775/week",
    website: "https://www.4ftandupkitchen.com/summer-camp"
  },
  {
    name: "ABADA-Capoeira San Francisco",
    description: "ABADÁ-Capoeira SF experiential camp is full of fun, friends, and learning! Campers spend the day learning Capoeira and maculelê movements; play different Capoeira instruments and rhythms; sing songs in Portuguese; and play Capoeira-based games that accentuate team building, leadership, and cooperation.",
    location: "Mission",
    ageRange: "Age 5-12",
    dates: "June 8 - August 7",
    hours: "9:00am - 4:00pm",
    pricing: "$550/child",
    website: "https://abada.org/summer-camp/"
  },
  {
    name: "Acrosports Circus Camp",
    description: "Experience in circus arts gives kids a chance to build strength, flexibility, and mind/body awareness, while also promoting the idea that skills are earned, and success in achieving them comes through the application of effort. Children are introduced to various circus disciplines including tumbling, juggling, clowning, dance and aerial arts.",
    location: "Cole Valley",
    ageRange: "Age 4.5-12",
    dates: "June 8 - August 14",
    hours: "8:45am - 3:00pm",
    pricing: "Lottery Enrollment",
    website: "https://www.acrosports.org/camps/"
  },
  {
    name: "Adventure Camp",
    description: "Now in year 56, Adventure Camp has been the Bay Area's only completely mobile day camp since 1971. Our campers learn about themselves and the world around them while having a great time exploring the city and countryside.",
    location: "Main Parade Lawn (Presidio)",
    ageRange: "Ages 4-12",
    dates: "June 4 - August 28",
    hours: "9:00am - 3:00pm",
    pricing: "$725/session",
    website: "https://adventurecampsf.com"
  },
  {
    name: "Aim High",
    description: "Aim High is a multi-year no-cost summer learning program for middle school students who come from low-income households or have limited access to summer enrichment. Aim High ignites a love of learning and prepares students for success in high school and beyond.",
    location: "San Francisco - Multiple Locations",
    ageRange: "Rising 5th - 8th",
    dates: "June 22 - July 24",
    hours: "8:30am - 3:30pm",
    pricing: "Free for those who qualify",
    website: "https://aimhigh.org/summer-2026/"
  },
  {
    name: "Alta Vista School Camp",
    description: "Alta Vista School is offering a camp at our Lower School Campus. We will have a variety of choices including maker/sewing, sports, cooking, lego, dungeons and dragons. There is a mix of outside vendors and teachers from the school.",
    location: "Portola",
    ageRange: "Kinder - 6th",
    dates: "June 22 - July 31",
    hours: "9:00am - 3:00pm",
    pricing: "$350 - $675",
    website: "https://www.homeroom.com/sites/alta-vista-school-san-francisco/summer-camp/camp-activities"
  },
  {
    name: "Alonzo King LINES Ballet Camp",
    description: "Alonzo King LINES Ballet Summer Programs are designed for aspiring artists ages 11-25 and offer a unified approach to training rooted in the philosophy of Alonzo King. Our Summer Program supports the artistic growth of ballet and contemporary dancers.",
    location: "SOMA",
    ageRange: "Age 11-25",
    dates: "June 8 - August 1",
    hours: "Hours Vary",
    pricing: "Prices vary",
    website: "https://linesballet.org/dance-education/summer-program/"
  },
  {
    name: "American Gymnastics",
    description: "At AGC gymnastics camp your child will be exposed to gymnastics, dance, music and art. The groups are limited to 12 gymnasts in each cohort.",
    location: "Bayshore",
    ageRange: "Age 5.5 and up",
    dates: "Register for Dates",
    hours: "9:00am - 3:00pm",
    pricing: "Register for Fees",
    website: "https://www.americangymnasticsclub.com/gymnastics-camp/"
  },
  {
    name: "Angel Island Day Camp by The Ranch",
    description: "Angel Island Camp is one of the Bay Area's best known and oldest summer day camps operating since 1977. Each week, there is a new theme with different activities. Campers will discover the island through games, crafts, nature, and by exploring its many trails & historic hideaways.",
    location: "Angel Island with SF Pick Up at Ferry Building",
    ageRange: "K - 7th Grade",
    dates: "Register for Dates",
    hours: "Vary depending on camp",
    pricing: "Vary depending on camp",
    website: "https://www.theranchtoday.org/summer-camps"
  },
  {
    name: "ANTS Sports",
    description: "All beginner and experienced players are welcome as we explore tennis, soccer, basketball, flag football, dodgeball, floor hockey, capture the flag, and SO much more in a non-competitive, progressive, and positive environment.",
    location: "Sunset and Cole Valley",
    ageRange: "K - 5th Grade",
    dates: "June 4 - August 14",
    hours: "9:00am - 4:00pm",
    pricing: "$495/week",
    website: "https://www.antssports.com/summer-sf/"
  },
  {
    name: "Artifact Art Camp",
    description: "ARTifact is committed to art and our community. All our curriculum is original and created in-house, inspired by the world around us. We are inspired by things like: Superhero colors, Shakespeare's First Folio, flowers made of glass, biomimicry, ancient Egypt, and more.",
    location: "Cow Hollow",
    ageRange: "Age 4-13",
    dates: "May 25 - August 28",
    hours: "9:00am - 1:00pm or 9:00am - 3:00pm",
    pricing: "$590-$735/session",
    website: "https://www.sfartifact.com/summer-campsanfrancisco"
  },
  {
    name: "ASEP Camp",
    description: "At CAMP ASEP, your child will have the opportunity to explore a variety of enriching activities and experiences designed to stimulate their minds, ignite their imaginations, and foster a love for learning. From hands-on STEAM projects to exciting outdoor play.",
    location: "TBD",
    ageRange: "Age 4 - 11",
    dates: "June 8 - July 22",
    hours: "8:00am - 5:00pm",
    pricing: "$350/week",
    website: "https://www.asepsf.org/camp-225004.html"
  },
  {
    name: "Aventuras",
    description: "Our Verano de Aventuras is based on Experiential Learning and offers each week a combination of fun and interactive activities in the areas of visual arts, STEM, music & movement, mindfulness, and culture & community.",
    location: "Mission St. & Noe Valley",
    ageRange: "Kindergarten - 5th Grade",
    dates: "June 5 - August 15",
    hours: "9:30am - 4:30pm",
    pricing: "$600/week",
    website: "https://www.aventurassf.com/summercamps"
  },
  {
    name: "Barrios Martial Arts",
    description: "Campers will be partaking in specialty activities, leadership activities, team building games, and of course, martial arts! We'll be following all safety protocol to ensure the health of all campers, coaches and staff.",
    location: "Potrero Hill",
    ageRange: "Age 4-11",
    dates: "June 16 - August 1",
    hours: "9:00am - 4:00pm",
    pricing: "$625-$675/week",
    website: "https://www.barriosmartialarts.com/youth-camps/"
  },
  {
    name: "Bay Club",
    description: "We are offering camp sessions for children aged 3–17 in our expansive properties. From sports-specific camps like tennis, golf, basketball, and squash, to multi-sport camps where kids will take classes like IGNITE, yoga, and more.",
    location: "Financial District and SOMA",
    ageRange: "Ages 3 - 17",
    dates: "Must log in for dates",
    hours: "9am - 1pm or 9am - 4pm",
    pricing: "Varies by camp",
    website: "https://www.bayclubs.com/amenity/kids-camps/"
  },
  {
    name: "Bird Rock Star Summer Music Camp",
    description: "Unleash Your Inner Rockstar! Have a song idea waiting to come to life? Ready to hit the studio and create your own music video? Includes songwriting & recording, music video production, performance & stage presence, and more.",
    location: "Russian Hill",
    ageRange: "Grades 2 - 9",
    dates: "June 8 - August 21",
    hours: "10:00am - 2:00pm or 10:00am - 5:00pm",
    pricing: "$550-$800",
    website: "https://www.bird-sf.com/camps"
  },
  {
    name: "Buena Vista Spanish Immersion",
    description: "The Buena Vista Spanish Immersion Summer Camp is dedicated to giving kids a fun and enriching summer experience in Spanish! Our program is designed by teachers credentialed in dual immersion education.",
    location: "Mission",
    ageRange: "Kinder - 4th Grade",
    dates: "Register for Dates",
    hours: "9:00am - 4:00pm",
    pricing: "$600/week or $3,600 for all six weeks",
    website: "https://www.buenavistachildcare.org/spanishimmersion"
  },
  {
    name: "Butterfly Joint Woodworking",
    description: "Camps at The Butterfly Joint are for children in 1st grade and up with a limit of 12 students per camp. Along with woodworking skills, The Butterfly Joint focuses on teaching children manners, personal and community responsibility and social justice.",
    location: "Outer Richmond",
    ageRange: "Grade 1 and Up",
    dates: "June 9 - August 22",
    hours: "9:00am - 3:00pm",
    pricing: "$475 - $530/week",
    website: "http://thebutterflyjoint.com/"
  },
  {
    name: "Calvary Nursery School Summer Camp",
    description: "Calvary Nursery School's summer camp hosts themed weeks full of developmentally appropriate activities, exploration, play, and fun!",
    location: "Pacific Heights",
    ageRange: "Age 2.5 to 6",
    dates: "June 16 - August 8",
    hours: "8:30am - 12:30pm or 8:30am - 3:00pm",
    pricing: "$400-$675",
    website: "https://www.calvarynurseryschoolsf.org/summer-camp-signup"
  },
  {
    name: "Camp 4K",
    description: "At Camp 4K, we believe in nurturing the next generation of innovators through a dynamic blend of Arts & Technology and Sports & Recreation. With our low student-teacher ratio, we ensure that every child receives the attention they need to flourish.",
    location: "Inner Sunset",
    ageRange: "Grades 1st - 7th",
    dates: "June 8th - 26th",
    hours: "9:30am - 3:30pm",
    pricing: "$1,350/three weeks",
    website: "https://www.camp4k.com/"
  },
  {
    name: "Camp Commotion",
    description: "Project Commotion presents a unique summer program that will get kids' brains and bodies in motion through multi-sensory embodied approaches to learning, physical, visual and theater arts, and literacy and language enrichment.",
    location: "Mission",
    ageRange: "Age 2 - 6",
    dates: "June 30 - August 1",
    hours: "Contact for hours",
    pricing: "$500/week, Sliding Scale Available",
    website: "https://www.projectcommotion.org/camp"
  },
  {
    name: "Camp Doodles",
    description: "Day camp with weekly theme and diverse activities. Kids are introduced to a variety of age-appropriate activities – some of which they'll be familiar with, some of which will be new. We kick-start imaginary play through fast-paced games, side-splitting skits and crazy adventures.",
    location: "Hayes Valley",
    ageRange: "PreK - 10th Grade",
    dates: "June 15 - August 14",
    hours: "9:00am - 4:00pm",
    pricing: "Varies by age and topic",
    website: "http://campdoodles.com/"
  },
  {
    name: "Camp Firedragon at CAIS",
    description: "Camp Firedragon brings summer magic to Chinese American International School and everyone's invited! Our program mixes school spirit with classic camp fun. From tiny campers to teens, Camp Firedragon has something for everyone 2.5-15!",
    location: "Park Merced",
    ageRange: "Age 2.5-14",
    dates: "June 15 - August 21",
    hours: "8:30am - 4:00pm",
    pricing: "Vary by camp",
    website: "https://campfiredragon.org/"
  },
  {
    name: "CampQuest Cantonese",
    description: "Camp C Quest immerses children in learning Cantonese through cooking, poetry & drama, outdoor activities, and crafts & games. Children are going technology free while exploring their creativity.",
    location: "Inner Sunset",
    ageRange: "Grades 1st - 6th",
    dates: "June 29 - July 10",
    hours: "9:15am - 3:45pm",
    pricing: "$850/two weeks",
    website: "https://campcquest.com/"
  },
  {
    name: "Canvas Dance Arts",
    description: "Mix it up with CANVAS Dance Arts! We will explore movement through new perspectives and collaborate with our peers to produce a final performance. Emphasis on dancers' creations, fitness and conditioning, site specific choreography, and video performance.",
    location: "Central Richmond",
    ageRange: "Grades K - 8",
    dates: "June 22 - July 31",
    hours: "9:00am - 3:00pm",
    pricing: "$560/week",
    website: "https://canvasdancearts.com/summer-camp-2026/"
  },
  {
    name: "Celsius and Beyond",
    description: "Celsius and Beyond is a boutique science camp for kids in 1-9 grades. Their instructors are scientists or professionals in their field. Camps include: surgery, neuroscience, genetics, anatomy, robotics, engineering, astronomy, art and science, metalsmith and more.",
    location: "Inner Richmond",
    ageRange: "Grades 1-9",
    dates: "June 9 - August 21",
    hours: "9:00am - 4:00pm",
    pricing: "$735/week",
    website: "https://celsiusandbeyond.com/camp-categories/summer-camp/"
  },
  {
    name: "Children's Creativity Museum",
    description: "Our experienced instructors are passionate about nurturing the next generation of theater artists. They provide a supportive, fun, and creative environment where every camper can shine.",
    location: "SOMA",
    ageRange: "Age 5 - 14",
    dates: "July 7 - August 1",
    hours: "9:00am - 12:00pm or 9:00am - 4:00pm",
    pricing: "$300 - $1,150/session",
    website: "https://creativity.org/summercamps/"
  },
  {
    name: "Children's Day School",
    description: "Calling all budding painters, builders, poets, farmers, scientists, engineers, athletes, chefs, coders, philosophers, and more! CDS San Francisconauts Summer Camp is your destination for inventive, collaborative and most importantly, fun summer learning.",
    location: "Mission",
    ageRange: "Preschool - 8th Grade",
    dates: "June 22 - August 7",
    hours: "Register for Details",
    pricing: "Register for Details",
    website: "http://camp.cds-sf.org/"
  },
  {
    name: "Chris Babcock Art Camp",
    description: "Our camps are designed for children who love to paint and draw in their spare time. Students learn how to mix complex acrylic or water-soluble oil paint colors, apply color theory, shade, highlight, layer paint. By the end of the 5 days, your child will complete a complex and beautiful painting.",
    location: "Central Richmond",
    ageRange: "Age 6.5 -17",
    dates: "June 8 - September 4",
    hours: "9:00am - 3:00pm",
    pricing: "$799/week",
    website: "https://chrisbabcockartprep.org/summer-art-camps-2026"
  },
  {
    name: "Church of Clown Circus",
    description: "In the circus, there's a place for everyone. Students will work on their acrobatics, juggling, aerial, and clowning skills. With plenty of time for games and physical conditioning, summer camp at Church of Clown is a childhood experience the kids will be pining after!",
    location: "Bayview",
    ageRange: "Age 7 - 13",
    dates: "July 7 - 18",
    hours: "9:00am - 3:00pm",
    pricing: "$500/week",
    website: "https://www.churchofclown.org/socialcircus"
  },
  {
    name: "Ciclo Sewing Lab",
    description: "Sewing & Fashion Camp - During camp each camper will learn the basics of machine sewing, then they can choose to work on any of the range of possible Up-cycling sewing projects such as hats, scarves, dresses, bags, stuffed animals, pillows, pants, aprons, and more.",
    location: "Inner Sunset",
    ageRange: "Age 6 - 14",
    dates: "June 8 - August 21",
    hours: "9:30am - 3:00pm",
    pricing: "$720/week",
    website: "https://ciclosf.com/"
  },
  {
    name: "Circus Center",
    description: "Our week-long camps offer a fun, safe and supportive environment where children can test their limits and explore their creativity with professional circus artists. Activities include: acrobatics, aerial arts, flying trapeze, juggling, clowning, stilts, equilibristics, songs and games.",
    location: "Cole Valley",
    ageRange: "Age 7-13",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$650/week",
    website: "http://circuscenter.org/camp"
  },
  {
    name: "City Kids Summer Camp",
    description: "At City Kid Camps we bring the knowledge of youth development and combine it with games, sports, the history of our city and the importance of our natural environment and let kids do what they do best – play – while safely guiding them through new locations and activities.",
    location: "Golden Gate Park",
    ageRange: "Age 8-12",
    dates: "June 8 - August 21",
    hours: "8:30am - 4:00pm",
    pricing: "$550/week",
    website: "https://www.sfcitykidcamp.com/"
  },
  {
    name: "Camp CMC Music",
    description: "Make great music and new friends at Community Music Center this summer! Camp CMC offers young musicians the chance to play in small and large groups and explore many musical styles such as Latin, jazz, classical, blues, folk, rock, American song book, and klezmer.",
    location: "Outer Richmond",
    ageRange: "Age 9-14",
    dates: "Dates vary by camp",
    hours: "9:00am - 3:00pm",
    pricing: "Vary depending on camp",
    website: "https://sfcmc.org/youth/summer-music-camps/"
  },
  {
    name: "Camp SFS at The San Francisco School",
    description: "Camp SFS at the San Francisco School. Since 1966, we've championed the belief that kids thrive when given the reins to their own adventures. Elementary school aged children become the architects of their days, choosing from activities like sewing, building, music, sports & recreation, crafts, Quiz Bowl, and more.",
    location: "Portola",
    ageRange: "PreK - 8th Grade",
    dates: "June 15 - July 24",
    hours: "9:00am - 3:30pm",
    pricing: "Prices Vary by camp",
    website: "https://the-san-francisco-school.jumbula.com/summer-2026"
  },
  {
    name: "Chabad Neighborhood Jewish Kids Summer Camp",
    description: "Join us for an unforgettable summer at our Jewish Kids Summer Camp, filled with exciting outdoor activities, creative arts, crafts, sports and Jewish spirit. Every week includes an exciting trip off grounds to explore and appreciate the beautiful city we live in.",
    location: "West Portal",
    ageRange: "Age 4 - 10",
    dates: "June 4 - 26",
    hours: "9:00am - 4:00pm",
    pricing: "$425/week",
    website: "https://www.chabadneighborhood.com/jksc"
  },
  {
    name: "Coastal Camp by NatureBridge",
    description: "A day at Coastal Camp is a day spent connecting with nature. Coastal Campers explore topics like marine biology, coastal ecology, conservation and cultural history, all against the beautiful backdrop of the Marin Headlands.",
    location: "Marin Headlands (with transportation from SF)",
    ageRange: "Grade K - 12",
    dates: "June 15 - August 14",
    hours: "9:30am - 3:30pm",
    pricing: "$595-$695/week",
    website: "https://coastalcamp.org/"
  },
  {
    name: "Coder School",
    description: "We're happy you're looking for options to get your kids learning to code. It's SUCH an amazing skill to learn! At theCoderSchool, we want to do more than just teach coding. We want aspiring coders to use their new found passion as a stepping stone to thinking outside the box.",
    location: "Inner Richmond and West Portal",
    ageRange: "Age 7 - 10+",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$599/week",
    website: "https://www.thecoderschool.com/sanfrancisco/"
  },
  {
    name: "Creative IQ Art Camp",
    description: "Campers learn fine art concepts, such as color theory, composition, value, and perspective while having fun exploring a variety of different mediums and activities, including painting, drawing, sculpting, arts & crafts and creativity games.",
    location: "Outer Richmond",
    ageRange: "Age 7-17",
    dates: "June 4 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "$640/week",
    website: "https://www.creativeiqsf.com/summer-camp.html"
  },
  {
    name: "Culinary Artistas",
    description: "Culinary Artistas Cooking Camps are weeklong camps for kids. Culinary Artistas camps teach an intuitive approach to cooking that empowers kids to discover their own creative perspective, both in the kitchen and in their lives outside of camp.",
    location: "Russian Hill",
    ageRange: "Age 4-10",
    dates: "June 8 - August 28",
    hours: "9:00am - 3:00pm",
    pricing: "$840/week",
    website: "https://culinaryartistas.com/kids/seasonal-kids-camps"
  },
  {
    name: "Dahlia School",
    description: "The Dahlia School strives to extend our community beyond our school walls. Central to our programming is a commitment to a rich arts and cultural environment, fostering creativity, critical thinking, and cultural appreciation.",
    location: "Mission Bay",
    ageRange: "Age 2-11",
    dates: "June 5 - July 26",
    hours: "Vary by Camp",
    pricing: "Vary by Camp",
    website: "https://thedahliaschoolsf.org/camps-and-classes"
  },
  {
    name: "Dance Mission Theater",
    description: "A multi-level full immersion dance program.",
    location: "Mission",
    ageRange: "Girls Age 6-13",
    dates: "June 8 - 26",
    hours: "Hours vary by camp",
    pricing: "Fees vary by camp",
    website: "http://www.dancemission.com/youth_program/summer_camps.html"
  },
  {
    name: "Dance Training Center SF",
    description: "A summer dance program suitable for all levels including beginner.",
    location: "Central Richmond",
    ageRange: "Girls Age 8 and Up",
    dates: "Dates vary by program",
    hours: "Vary by Camp",
    pricing: "Vary by Camp",
    website: "https://www.dtc-sf.com/"
  },
  {
    name: "Dogpatch Games Camp",
    description: "Dogpatch Games Summer Camp gives kids the chance to experience all of what tabletop gaming has to offer. From board games to D&D, campers will learn the values of sportsmanship, competition, and cooperation. Over the course of the week, campers will experience a full D&D Campaign, paint a custom miniature of their character.",
    location: "Dogpatch",
    ageRange: "Age 8-17",
    dates: "June 15 - August 14",
    hours: "9:00am - 5:00pm",
    pricing: "$725 - $895",
    website: "https://www.dogpatch.games/kids-summer-camp"
  },
  {
    name: "Dogpatch Paddle SUP Camp",
    description: "Adventure awaits! We'll teach them how to be safe, paddle strong, appreciate the raw wilderness of the Bay, while creating lifelong memories with new and old friends alike. No paddle experience is necessary.",
    location: "Dogpatch",
    ageRange: "Age 7-16",
    dates: "June 1 - August 21",
    hours: "8:30am - 3:00pm",
    pricing: "Vary by Camp",
    website: "https://dogpatchpaddle.com/summer-camp-san-francisco"
  },
  {
    name: "Education Francais Bay Area",
    description: "Our camp is an opportunity for the children to spend an unforgettable summer vacation in French right in the heart of the San Francisco Bay Area. The language is a tool for activities, games and exciting encounters.",
    location: "Sunset",
    ageRange: "Age 4 - 12",
    dates: "June 11 - August 7",
    hours: "8:30am - 3:00pm",
    pricing: "Vary by Camp",
    website: "https://efba.us/french-summer-camps-bay-area-2/"
  },
  {
    name: "Eureka Valley Arts",
    description: "Let's get together this summer at Eureka Valley Arts to create great projects, enjoy awesome adventures, and build amazing friendships. EVA Summer Camps offer a place to build community, expand imagination, and strengthen self-confidence.",
    location: "Diamond Heights and Eureka Valley",
    ageRange: "Age 5 - 12",
    dates: "June 9 - August 15",
    hours: "9:00am - 5:00pm",
    pricing: "$575/week",
    website: "https://eurekavalleyarts.com/"
  },
  {
    name: "Fightin' Irish Sports Academy",
    description: "The Fightin' Irish Sports Academy is a series of intensive sports camps designed to advance the skills of motivated student athletes ages 9-14. Instructed by SHC's top coaching staff and current student-athletes.",
    location: "Fillmore District",
    ageRange: "Age 9-14",
    dates: "June 8 - July 17",
    hours: "9:00am - 3:00pm",
    pricing: "$525/week",
    website: "https://www.shcp.edu/summer/fightin-irish-sports-academy"
  },
  {
    name: "The First Tee Golf",
    description: "Golf! Introduction to the 9 core values and their importance on and off the golf course. Building interpersonal skills and goal setting.",
    location: "Park Merced",
    ageRange: "Age 6-17",
    dates: "June 9 - August 9",
    hours: "Hours Vary",
    pricing: "$300-$700/session",
    website: "https://firstteesanfrancisco.org/homepage/register/"
  },
  {
    name: "Forest Bloom Outdoor Summer Camp",
    description: "Reggio-Emilia inspired outdoor forest camp! Join us for an extension of our forest school on a fun, week long nature adventure in various Golden Gate Park locations. Jumping in puddles, making mud cakes, pet worms, fairy doors, twisty trees to climb!",
    location: "Golden Gate Park and Presidio",
    ageRange: "Age 2.5 - 6",
    dates: "June 4 - September 4",
    hours: "9:00am - 3:00pm",
    pricing: "Prices Vary by Camp",
    website: "https://forestbloomschool.com/our-camps"
  },
  {
    name: "Frame Art Studio",
    description: "Explore the wonders of art and nature at our Summer Art & Nature Camp! Let your child unleash their creativity with fun activities and outdoor adventures. Kids will enjoy painting, crafting, and outdoor activities.",
    location: "Portola",
    ageRange: "Age 5 - 12",
    dates: "June 9 - July 25",
    hours: "10:00am - 2:00pm",
    pricing: "$360/session",
    website: "https://frameartstudio.com/art-classes"
  },
  {
    name: "Galileo Camp",
    description: "Camp Galileo inspires a spirit of bold exploration in pre-K through 5th graders. Grouped by grade, campers take on art, science and outdoor activities tailored specifically to their level, all while learning lasting innovation skills like collaboration and reflection.",
    location: "Hayes Valley and Twin Peaks",
    ageRange: "K - 10th Grade",
    dates: "June 22 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$540-$610/week",
    website: "http://www.galileo-camps.com/"
  },
  {
    name: "Gem Studio",
    description: "Multi-Media art camp in the Mission District!",
    location: "Mission",
    ageRange: "Age 5-12",
    dates: "June 9 - August 15",
    hours: "9:00am - 3:00pm",
    pricing: "$550-$575/week",
    website: "https://www.gemstudiosf.com/summer-camps"
  },
  {
    name: "German International School of Silicon Valley",
    description: "Open to Everyone Interested in Learning German! Our summer camps are designed to provide enriching experiences for ages 3.6 to 14. From our immersive German pedagogy to signature academic German language classes paired with afternoon fun. No prior German language required.",
    location: "Castro",
    ageRange: "PreK - 8th Grade",
    dates: "June 29 - July 31",
    hours: "9:00am - 4:00pm",
    pricing: "$590/week",
    website: "https://www.gissv.org/gissv-home-english/locations/summer-camp"
  },
  {
    name: "Giants Baseball Camp",
    description: "Giants Baseball Camps features action-packed days of individualized instruction, marquee competitions, and special events. Each day features a personal character theme, teaching campers lessons on the diamond that they can utilize off the field.",
    location: "West Sunset and Balboa Park",
    ageRange: "Age 4 - 15",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$695 - $795/week",
    website: "https://www.mlb.com/giants/fans/experiences/youth-camps"
  },
  {
    name: "Girlfly Aerial Dance",
    description: "The Summer Arts & Activism Project will bring 20 young women/GNC youth from San Francisco for four weeks to get hands-on experience in aerial dance, earn $500, create and perform original dances, and learn about issues of girls'/GNC youth empowerment.",
    location: "Civic Center",
    ageRange: "Girls Age 14-19",
    dates: "July 6 - July 30",
    hours: "10:00am - 3:00pm",
    pricing: "Apply for pricing",
    website: "https://flyawayproductions.com/youth/"
  },
  {
    name: "Girls Unite Soccer",
    description: "Elevate Your Game: All-Day Soccer Skill Building! Open to all levels: Beginner, Intermediate, and Advanced players are welcome. All genders welcome! Campers will be grouped by age and skill level.",
    location: "TBD",
    ageRange: "Age 5 - 15",
    dates: "June 5 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "Vary by dates and month",
    website: "https://girlsunite.org/camps-2/"
  },
  {
    name: "Golden Bridges Farm Camp",
    description: "Farm Camp is run from our 1-acre school farm in the Mission Terrace neighborhood. We provide an opportunity for children to connect with nature while directly participating in the daily rhythms of farm life. Activities include animal care, planting, weeding, watering, mulching, harvesting, compost care, crafts and free play.",
    location: "Mission Terrace",
    ageRange: "Age 4.5-12",
    dates: "June 15 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$500/week",
    website: "https://www.goldenbridgesschool.org/farm-camp.html"
  },
  {
    name: "Golden Gate Art & Nature",
    description: "Children's art camp.",
    location: "Laurel Heights",
    ageRange: "Age 3-7",
    dates: "June 2 - August 15",
    hours: "Hours vary by age",
    pricing: "$600 - $700/week",
    website: "https://ggartnature.com/"
  },
  {
    name: "Golden Gate Skateboarding",
    description: "Join us for skateboarding camp! Each day we will start camp with an introduction to skateboarding specific stretching/yoga routines. We'll cover beginner level skills like pushing, turning, drop-ins, and kick-turns, all the way up to more advanced skills like Ollies, kickflips, 50-50 grinds.",
    location: "Waller St./Balboa/Hilltop Skateparks",
    ageRange: "Age 6-14",
    dates: "June 9 - August 29",
    hours: "9:30am - 3:30pm",
    pricing: "$525/week",
    website: "https://goldengateskateboarding.com/pages/available-classes-camps"
  },
  {
    name: "Goldman Tennis Center",
    description: "Join the leader in Fun and Learning! Lifetime Activities has been providing amazing youth camp experiences for over 25 years! We offer a variety of youth tennis camps that will take your child's game to the next level.",
    location: "Golden Gate Park",
    ageRange: "Age 4-15",
    dates: "June 2 - August 15",
    hours: "Vary by Camp",
    pricing: "Vary by Camp",
    website: "https://www.lifetimeactivities.com/san-francisco/"
  },
  {
    name: "Grasshopper Kids Camp",
    description: "Grasshopper Kids Camps are full weeks of engaging, in-person experiences for your kids and their friends, led by talented teachers who come to you. Experiences are tailored to the group's ages and interests.",
    location: "At your home (teacher comes to you!)",
    ageRange: "Age 3-12",
    dates: "June 1 - August 31",
    hours: "9:00am - 12:00pm OR 1:00pm - 4:00pm",
    pricing: "Prices Vary by Camp",
    website: "https://www.grasshopperkids.com/camps"
  },
  {
    name: "Lion's Camp at The Hamlin School",
    description: "Open to the public and led by esteemed Hamlin staff, LIONS Camp includes both academic and recreational programs. Recreational programs include Art & Science Adventures, Learn-to-Bike, Ceramics, Rock Climbing, Soccer, Dance, and more.",
    location: "Pacific Heights",
    ageRange: "Grades 1-9",
    dates: "June 22 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "Prices Vary by Camp",
    website: "https://hamlin.org/summer-camp/"
  },
  {
    name: "Hilltop Creative",
    description: "We are excited to spend the week being creative, building community and making friendships. During our days together we will start our mornings with free exploration, morning greetings, snack and an indoor creative activity. Nature is a huge focus with neighborhood hikes.",
    location: "Bernal Heights",
    ageRange: "Age 4 - 10",
    dates: "June 5 - August 14",
    hours: "9:00am - 4:00pm",
    pricing: "$750/week",
    website: "https://www.hilltopcreative.studio/camps"
  },
  {
    name: "House of Air Trampoline Camp",
    description: "Join us for Camp at House of Air San Francisco! Youth flyers will have exclusive access to the Matrix and Dodgeball Colosseum. One of the coolest parts of camp is when flyers spend time with our Training Ground pros and learn all the flips and tricks.",
    location: "Crissy Field",
    ageRange: "Age 6 -12",
    dates: "June 8 - August 21",
    hours: "Varies by Age",
    pricing: "Varies by Age",
    website: "https://houseofair.com/san-francisco/programs/camps/"
  },
  {
    name: "iD Tech Camp",
    description: "At iD Tech, kids and teens of all skill levels discover coding, AI, machine learning, film, robotics, and game design, developing the in-demand skills needed to compete at SF Bay Area companies like EA, Pixar, Roblox, and Twitter.",
    location: "Park Merced",
    ageRange: "Age 7-17",
    dates: "June 15 - July 24",
    hours: "Check Site for Hours",
    pricing: "Check Site for Fees",
    website: "https://www.idtech.com/locations/california-summer-camps/san-francisco-state-university"
  },
  {
    name: "Infinite Martial Arts",
    description: "Our summer camps are offered every year throughout the summer. While practicing their Martial Arts is an essential part of the camp, we also incorporate fun activities such as local hikes, trips to the playground, and arts & crafts activities.",
    location: "Marina",
    ageRange: "Age 3-12",
    dates: "June 1 - August 28",
    hours: "9:30am - 3:00pm",
    pricing: "Register to see fees",
    website: "https://infinite-martialarts.com/summer-camp-program/"
  },
  {
    name: "Intro to Fencing",
    description: "Our Intro to Fencing Summer Camp is designed for beginners with little to no prior experience. Fencers will learn the fundamentals of footwork, blade work, and fencing rules in a fun, structured, and supportive environment.",
    location: "Mission Bay",
    ageRange: "Age 5 - 14",
    dates: "July 6 - August 21",
    hours: "9:00am - 12:00pm",
    pricing: "$600/week",
    website: "https://gsfencers.com/camps"
  },
  {
    name: "It's Yoga Kids",
    description: "Campers strengthen and stretch their bodies, minds and hearts with yoga and mindfulness practice, Presidio nature hikes and exploration, games and art projects. We are 100% outdoors!",
    location: "Presidio",
    ageRange: "Age 4-12",
    dates: "June 9 - August 29",
    hours: "9:00am - 2:00pm",
    pricing: "$499/week",
    website: "https://www.itsyogakids.com/schedule/product/15-it-s-yoga-camps"
  },
  {
    name: "JCCSF Summer Camp",
    description: "SHERRI'S TOP PICK! Such a diverse offering from musical theater and S.T.E.A.M to outbound adventures. Kids will get plenty of outdoor time regardless of which camp you choose. The counselors are phenomenal.",
    location: "Presidio Heights",
    ageRange: "Age 2 - 16",
    dates: "5/26 - 8/21",
    hours: "Varies by program/age",
    pricing: "Varies by program",
    website: "https://www.jccsf.org/program/summer-camp/"
  },
  {
    name: "Jim Millinder's Girls Soccer Camp",
    description: "The camp will provide instruction on a wide range of areas, including dribbling, turns, shooting, passing, trapping, and move development. GIRLS ONLY, ages 5-12, all skill levels welcome.",
    location: "Lone Mountain",
    ageRange: "Age 5 - 12 (Girls Only)",
    dates: "June 5 - July 26",
    hours: "8:30am - 4:00pm",
    pricing: "$299-$599",
    website: "http://www.jimmillindersusfgirlssoccercamp.com/"
  },
  {
    name: "Just Us Dragons Art Camp",
    description: "Join in the fun this summer with JUST US DRAGONS ART CAMP! All children will have the opportunity to conceptualize their own creation; bringing life to seemingly lifeless objects.",
    location: "Inner Richmond",
    ageRange: "Grades 2-6",
    dates: "July 6 - July 17",
    hours: "8:30am - 4:00pm",
    pricing: "$575/week",
    website: "https://www.justusdragons.com/"
  },
  {
    name: "Katherine Michiels School",
    description: "KMS Summer Camp is a Reggio Emilia inspired program with a focus on project-based learning, exploration, and community building while incorporating design thinking and creativity into every interaction.",
    location: "Mission",
    ageRange: "Age 5-11",
    dates: "June 1 - August 7",
    hours: "9:30am - 3:00pm",
    pricing: "$1,600/three week session",
    website: "https://www.kmsofsf.org/summer-camps"
  },
  {
    name: "Kidstock Musical Theater",
    description: "Our summer programs allow space for campers to express themselves, build self esteem, make new friends, and have fun while putting together a musical production! The final show is presented live and captured on video for life long memories.",
    location: "Inner Sunset, Potrero Hill and Mission",
    ageRange: "Kindergarten - 8th Grade",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "Vary, check website",
    website: "https://kidstockinc.org/programs/summer-programs/"
  },
  {
    name: "Kittredge School",
    description: "The Kittredge Summer Program offers the best of both worlds. Students keep their academic skills sharp with an academic session each morning, and engage in various active and fun pursuits each afternoon.",
    location: "Seacliff",
    ageRange: "Grades 1 - 8",
    dates: "June 22 - July 24",
    hours: "Register for Information",
    pricing: "Register for Information",
    website: "https://www.kittredge.org/summer-school"
  },
  {
    name: "La Scuola Summer Camp (Italian)",
    description: "As the first Reggio Emilia, International Baccalaureate Italian Immersion school in the world, La Scuola International School Summer Camps are an extraordinary experience. Every camp week will offer an interdisciplinary educational experience.",
    location: "Dogpatch and Mission",
    ageRange: "PreK - 5th Grade",
    dates: "June 22 - July 24",
    hours: "9:00am - 4:00pm",
    pricing: "Vary by camp",
    website: "https://www.lascuolasf.org/learning/extended-day-camps"
  },
  {
    name: "Legarza Sports Camp",
    description: "Legarza programs give children the knowledge and motivation they need to achieve their personal best in sport and life. Over 200,000 of the Bay Area's youth have experienced our 29-year, proven and tested system.",
    location: "Glen Park, Marina, Sunset and Lake Merced",
    ageRange: "Grades K - 8th",
    dates: "June 8 - August 14",
    hours: "Vary by Location",
    pricing: "Vary by Location",
    website: "http://www.legarzasports.org/"
  },
  {
    name: "Little Forest Explorers",
    description: "With every step children take in the outdoors, they are making critical decisions that exercise their executive function. These are the skills that help us plan, negotiate, prioritize, multitask, problem-solve, create, and navigate.",
    location: "Golden Gate Park",
    ageRange: "Ages 3 - 9",
    dates: "June 16 - July 25",
    hours: "8:45am - 3:00pm",
    pricing: "Register for information",
    website: "https://www.littleforestexplorers.com/basic-01"
  },
  {
    name: "Little Llamas Spanish",
    description: "The Little Llamas offers a summer camp where children are exposed to the Spanish language and South American culture. Our approach consists of teaching Spanish gradually and gently.",
    location: "Outer Richmond",
    ageRange: "Age 3 - 10",
    dates: "July 7 - July 25",
    hours: "9:00am - 3:00pm",
    pricing: "$650/week",
    website: "https://thelittlellamas.com/"
  },
  {
    name: "The Little Studio",
    description: "The Little Studio is a process-based children's art program. Our thoughtfully designed classes introduce children to a variety of art materials, like sewing, painting, and more, while honoring the whole child.",
    location: "Hayes Valley",
    ageRange: "Kindergarten - 4th Grade",
    dates: "July 13 - July 24",
    hours: "9:00am - 1:30pm",
    pricing: "$500-$675/week",
    website: "https://www.thelittlestudio-sf.com/"
  },
  {
    name: "Lycee Francais",
    description: "We are gearing us for a new edition of the Lycée Summer camps! Our seven-week Summer Camp will offer diverse and exciting activities, with weekly themes to be determined. Lycée summer camps are open to the public.",
    location: "Haight and Sunset",
    ageRange: "PreK - 5th Grade",
    dates: "June 16 - August 21",
    hours: "9:00am - 4:00pm",
    pricing: "Vary by Camp",
    website: "https://www.lelycee.org/on-campus/camps"
  },
  {
    name: "Manos",
    description: "All of our teachers bring years of experience to the table and help to foster community and a sense of belonging for each child. We are proud to offer a ratio of 2 teachers to 14 children per class.",
    location: "Outer Sunset",
    ageRange: "Age 4-11",
    dates: "June 4 - August 14",
    hours: "9:00am - 2:00pm",
    pricing: "$625/week",
    website: "https://www.manossf.com/camps"
  },
  {
    name: "Mathnasium",
    description: "Have a blast with math this summer! Explore STEM-related activities & games & learn math face-to-face with Mathnasium experts at our location in the Marina.",
    location: "Marina",
    ageRange: "Grades K-5",
    dates: "June 9 - August 15",
    hours: "9:00am - 3:00pm",
    pricing: "$695/Week",
    website: "https://www.mathnasium.com/math-centers/pacificheightssf/news/mathnasium-summer-camps-2025"
  },
  {
    name: "Messy Art Lab",
    description: "Messy Art Lab provides a creative and open-ended environment where kids can experiment, enjoy the process of making art and bring their ideas to life. Camper to collaborator ratios are 5:1 or better!",
    location: "Inner Sunset",
    ageRange: "Age 4-8",
    dates: "June 8 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "$850/week",
    website: "www.messyartlab.com"
  },
  {
    name: "Movement SF Climbing Camp",
    description: "We offer climbing camps during summer break! During a week at climbing camp, your kids will explore all of the features of the gym. They will have fun on the bouldering walls, high roped climbing, and play awesome climbing games.",
    location: "Presidio",
    ageRange: "Age 6 - 17",
    dates: "June 8 - August 14",
    hours: "9:00am - 12:00pm or 1:00pm - 5:00pm",
    pricing: "Vary, check website",
    website: "https://movementgyms.com/san-francisco/climbing/youth-programs/"
  },
  {
    name: "Moving Arts Academy Dance",
    description: "This is a fun dance camp for all levels! This camp will include a daily dance class, choreography exploration, dance games, arts and crafts, and a daily visit to nearby Balboa Park for lunch and free time.",
    location: "Mission Terrace",
    ageRange: "Age 4 - 13",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$600/week",
    website: "https://movingartsacademyofdance.com/camps-intensives"
  },
  {
    name: "Music, Art & Adventure Camp",
    description: "At camp, children have days filled with exploration of San Francisco's very own National Park: The Presidio. Each week we explore a different corner of the Park such as Baker Beach, Crissy Field, and Inspiration Point.",
    location: "Presidio",
    ageRange: "Kindergarten - 5th Grade",
    dates: "June 15 - August 14",
    hours: "9:00am - 4:00pm",
    pricing: "$615 - $1,055/session",
    website: "http://www.MusicArtAdventure.com"
  },
  {
    name: "Musical Theater Works",
    description: "Musical Theatre Works offer a unique summer immersion program where students experience all aspects of Musical Theatre production and performance. Classes include Voice, Acting, Dance, Stagecraft and Design and Film Study.",
    location: "Cathedral Hill",
    ageRange: "K - 9th Grade",
    dates: "June 8 - August 7",
    hours: "Vary by camp",
    pricing: "Vary by camp",
    website: "https://musicaltheatreworks.org/#card-4tcqbb2yykpin3i"
  },
  {
    name: "Mythik Camp",
    description: "Fantasy camp where you will learn leadership, literacy and social courage.",
    location: "Golden Gate Park",
    ageRange: "Grades 2 - 6",
    dates: "June 22 - July 31",
    hours: "8:45am - 4:00pm",
    pricing: "$625/week",
    website: "https://www.mythikcamps.com/dates-rates-locations/"
  },
  {
    name: "Nike Soccer Camp",
    description: "The Academy Camps are taught by the current USF Men's Soccer coaching staff, along with current and past USF soccer players, not to mention top youth coaches.",
    location: "Outer Sunset",
    ageRange: "Age 7-14",
    dates: "June 8 - July 10",
    hours: "Register for information",
    pricing: "Register for information",
    website: "https://www.ussportscamps.com/soccer/nike/nike-soccer-camp-st.-ignatius-college-preparatory"
  },
  {
    name: "Nine Studio Art",
    description: "Art Camp; drawing, painting (both watercolor and acrylic), 3D craft, animation and comic books.",
    location: "Russian Hill",
    ageRange: "Age 6-14",
    dates: "June 15 - August 28",
    hours: "9:00am - 3:00pm",
    pricing: "Register for information",
    website: "https://www.nine.education/"
  },
  {
    name: "ODC Dance",
    description: "Embark on a summer of creativity and movement with ODC. From dynamic weekend dance classes to imaginative week-long intensives, our programs are designed for students ages 2-18 of all levels.",
    location: "Mission",
    ageRange: "Age 8-17",
    dates: "June 8 - July 24",
    hours: "Hours Vary by Camp",
    pricing: "Vary by Camp",
    website: "https://odc.dance/summer"
  },
  {
    name: "One Martial Arts",
    description: "The award-winning One Martial Arts Kids FUN Camp features kid approved themes, martial arts, life-skills education, child safety, outdoor activities, arts & crafts, dodgeball, Legos, relay races, soccer, iPad lab, games, and reading time.",
    location: "Inner Parkside",
    ageRange: "Age 5 - 12",
    dates: "Register for Information",
    hours: "Register for Information",
    pricing: "Register for Information",
    website: "https://onemartialarts.com/program/kids-fun-camp/"
  },
  {
    name: "Outsider ArtShop Sewing",
    description: "Kids ages 7-11 gather for an all week sewing camp! Kids will discuss as a group what projects we want to tackle based on a huge database of fun sewing projects. Examples: stuffies, bags, embroidery, crocheting, weaving, DIY screen printing, fashion illustration.",
    location: "Mission",
    ageRange: "Age 7-11",
    dates: "June 17 - August 16",
    hours: "9:00am - 3:00pm",
    pricing: "$600/week",
    website: "https://www.outsiderartshop.com/book-online"
  },
  {
    name: "Parks + Creation's Coyote Camp",
    description: "Parks Plus Creation Coyote Camps are all about discovery and following the interests of the children; we draw from Reggio Emilia philosophy and Forest Kindergarten approach. Each day is a new adventure.",
    location: "Presidio",
    ageRange: "Age 3-10",
    dates: "June 8 - August 7",
    hours: "Hours vary",
    pricing: "Fees vary by age and session",
    website: "https://www.parkspluscreation.com/coyote-camp"
  },
  {
    name: "Peekadoodle Preschool Summer Camp",
    description: "Peekadoodle camps include art activities, cooking class, music and dance, outdoor exploration, and more! Our camps are led by our experienced school-year preschool teachers.",
    location: "Inner Richmond",
    ageRange: "Age 3-5 (Potty Training Required)",
    dates: "June 15 - August 20",
    hours: "8:45am - 12:45pm",
    pricing: "$725/week",
    website: "https://www.peekadoodle.com/camp"
  },
  {
    name: "Petits Pas Yoga & Dance Studio",
    description: "Bilingual (French/English) summer camps, available from complete beginners to native French speakers. Camp highlights: Dance, Yoga, Acrobatics, Theatre, Crafts & French!",
    location: "Balboa Terrace",
    ageRange: "Age 5-10",
    dates: "June 8 - July 17",
    hours: "9:00am - 3:00pm",
    pricing: "$725-$1,450",
    website: "https://www.petitspasstudio.com/camps"
  },
  {
    name: "Presidio Knolls Mandarin",
    description: "PKS offers K-8 Mandarin Immersion summer camp. Mandarin language skills are not required for kindergartners at our camps. Mandarin language skills are required for students in grades 1-8.",
    location: "SOMA",
    ageRange: "Rising Kinder - 8th Grade",
    dates: "June 23 - August 15",
    hours: "Hours vary by camp",
    pricing: "Vary by camps",
    website: "https://www.presidioknolls.org/summercamp"
  },
  {
    name: "The Rabbit Hole Theater Company",
    description: "Nurture your child's creativity with the magic of pretend play! Our enchanting themed day camps include high-quality crafting, silly puppet shows, fun theater games, costume making, and more!",
    location: "Noe Valley",
    ageRange: "Age 4 - 11",
    dates: "June 4 - September 7",
    hours: "9:00am - 4:00pm",
    pricing: "Varies by Camp",
    website: "http://www.therabbitholesf.com/for-children/Camps"
  },
  {
    name: "Randall Museum",
    description: "Randall Museum offers Day Camps serving kids ages 6 to 12 when school is out of session. Camps include a wide range of science, art, technology, nature study and physical play.",
    location: "Upper Market",
    ageRange: "Age 6 - 12",
    dates: "June 9 - August 1",
    hours: "Vary by camp",
    pricing: "Vary by camp",
    website: "https://randallmuseum.org/"
  },
  {
    name: "Renegade Tinkering Club",
    description: "SHERRI'S TOP PICK!! Girls only and Coed STEM camps with hands-on projects. From the moment our club members arrive, they are surrounded by successful, smart, trailblazing role models who encourage them to pursue their love of science, exploration and building.",
    location: "Park Merced and MacLaren Park",
    ageRange: "Grade 1st - 5th",
    dates: "June 5 - August 11",
    hours: "9:00am - 5:00pm",
    pricing: "$595/week",
    website: "http://www.renegadegirlstinkeringclub.com/"
  },
  {
    name: "Richmond District Neighborhood Center",
    description: "The Richmond Neighborhood Center offers a wide range of summer camps for elementary, middle, and high school students.",
    location: "Central Richmond",
    ageRange: "Grade 1 - 12th",
    dates: "Dates vary by grade",
    hours: "Vary by camp",
    pricing: "Sliding Scale, contact for more information",
    website: "https://richmondsf.org/youth/summer-camp/"
  },
  {
    name: "Rock Band Land",
    description: "RBL Summer is two weeks of music, art, comedy, writing, video production, physical activities, friends, laughter, pickles, popcorn, popsicles, UGLY BABY making, and rock shows. There is no other camp like it.",
    location: "Mission",
    ageRange: "Ages 6 - 13",
    dates: "June 4 - August 28",
    hours: "9:00am - 4:00pm",
    pricing: "$1,500/two weeks",
    website: "https://www.rockbandland.org/rbl-summer"
  },
  {
    name: "Roughin it Day Camp",
    description: "Make It the Best Summer Yet. Imagine a summer where your child has the time of their life and grows as a person in ways that will impact who he or she is for the rest of their life.",
    location: "Lafayette (East Bay) with SF pick up",
    ageRange: "Ages 4-16",
    dates: "June 15 - August 7",
    hours: "Check Website",
    pricing: "Check Website",
    website: "https://www.roughingit.com/"
  },
  {
    name: "Russo Music",
    description: "A week-long program that incorporates singing, choreographing dance, exploring new instruments, and forming a pop-rock band! We'll culminate each session with a performance video for friends and families!",
    location: "Noe Valley",
    ageRange: "Age 5-12",
    dates: "June 15 - July 17",
    hours: "9:00am - 3:00pm",
    pricing: "$600/week",
    website: "https://www.russomusicsf.com/"
  },
  {
    name: "Sacred Heart Summer Institute",
    description: "The SHC Summer Institute is a series of one-week enrichment courses and sports academies for motivated students and athletes ages 8-14. Students explore exciting topics through hands-on learning and field trips.",
    location: "Fillmore District",
    ageRange: "Grades 3rd - 9th",
    dates: "June 8 - July 17",
    hours: "9:00am - 3:00pm",
    pricing: "$525/week",
    website: "https://www.shcp.edu/summer/junior-irish-academy"
  },
  {
    name: "Seabird Preschool Summer Camp",
    description: "Seabird Preschool's goal is to nurture, guide, and support our students by giving them appropriate tools to grow and challenge themselves emotionally, socially, and cognitively.",
    location: "Financial District",
    ageRange: "Age 2 - 6",
    dates: "June 9 - August 15",
    hours: "7:30am - 12:15pm or 7:30am - 5:30pm",
    pricing: "$550-$680/week",
    website: "https://www.seabirdpreschool.com/summercamp"
  },
  {
    name: "Secret Agent Squad",
    description: "Established in 2015, Secret Agent Squad is a unique summer camp experience that allows kids to learn spy skills and use their spy training on exciting missions at the end of each camp week.",
    location: "Diamond Heights",
    ageRange: "Age 6 - 12",
    dates: "June 8 - August 21",
    hours: "9:00am - 4:00pm",
    pricing: "$560/week",
    website: "https://www.secretagentsquad.com/"
  },
  {
    name: "Seeing School Photography",
    description: "Our curriculum takes students on a journey through the many layers of vision—from the anatomy of the eye and the science of perception to the ways culture, memory, and imagination shape what we see.",
    location: "Presidio",
    ageRange: "Age 8 - 12",
    dates: "June 8 - August 13",
    hours: "9:00am - 3:00pm",
    pricing: "$1,200/week",
    website: "https://www.seeingschool.org/summer-camps"
  },
  {
    name: "SF Aftershocks Soccer Camp",
    description: "Aftershocks is a girls only soccer club. The camp is meant for kids of all soccer levels.",
    location: "South Sunset and Beach Chalet",
    ageRange: "Age 7 - 14 (Girls Only)",
    dates: "June 16 - August 22",
    hours: "9:00am - 3:00pm",
    pricing: "$425/week",
    website: "https://sfaftershocks.com/"
  },
  {
    name: "SF Arts Education Project Summer Camp",
    description: "SFArtsED summers are magical times, as children ages 6-14 immerse themselves in the arts—collaborating with many of the same extraordinary artists who teach in our residence programs in the public schools.",
    location: "Western Addition",
    ageRange: "Age 6 - 14",
    dates: "June 15 - July 24",
    hours: "9:00am - 3:00pm",
    pricing: "$550-$1,130",
    website: "https://www.sfartsed.org/programs/summer-camp/"
  },
  {
    name: "SF Baseball Camp",
    description: "Skill Development Drills in the morning, Lunch from 12-12:30 pm, Baseball game in the afternoon.",
    location: "Inner Richmond",
    ageRange: "Age 6-13",
    dates: "June 8 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "$165-$630",
    website: "https://www.sfbaseballacademy.com/camps"
  },
  {
    name: "SF Botanical Garden - Garden Camp",
    description: "Garden Camp is back for an exciting summer of outdoor fun and learning! Connecting children to plants and each other through structured activities and unstructured play amidst plants from around the world.",
    location: "Golden Gate Park",
    ageRange: "Age 5-10",
    dates: "June 29 - August 14",
    hours: "9:00am - 4:00pm",
    pricing: "$1,160-$1,300",
    website: "https://gggp.org/learn/family-community/garden-camp/"
  },
  {
    name: "SF Fencers",
    description: "Beginner Camp - Come join us for a week of fun with the foil. Every class will include daily warm ups, games, footwork, attacks and fundamentals of defensive actions and bouting with a partner.",
    location: "Outer Richmond",
    ageRange: "Age 7 -14",
    dates: "June 15 - August 7",
    hours: "1:00pm - 4:00pm",
    pricing: "$400/week",
    website: "http://sffencers.com/classes-camps/"
  },
  {
    name: "SF Gymnastics",
    description: "If you are looking for a healthy, active and exciting place for your child to spend his/her summer, San Francisco Gymnastics is what you need. Every morning we have gymnastics, games, arts and crafts.",
    location: "Western Addition",
    ageRange: "Age 4.5 - 12",
    dates: "Register for dates",
    hours: "Register for Details",
    pricing: "Register for Details",
    website: "https://sanfranciscogymnastics.com/camps/"
  },
  {
    name: "SF Math Circle",
    description: "At the San Francisco Math Circle, we make math accessible, inclusive, and fun! The SF Math Circle is an extracurricular math enrichment program that helps students develop their mathematical thinking skills.",
    location: "Park Merced (SF State)",
    ageRange: "Rising 3rd - 6th",
    dates: "June 22 - August 7",
    hours: "9:00am - 3:00pm",
    pricing: "$500/week",
    website: "https://www.sfmathcircle.org/math-camp"
  },
  {
    name: "SF Parks & Rec",
    description: "OMG, soooo many options. Sports, nature, arts, swimming.. you name it, they offer it! Probably the largest offering in the city.",
    location: "All over the city!",
    ageRange: "Age 4 - 19",
    dates: "June 9 - August 15",
    hours: "9:00am - 3:00pm or 4:00pm",
    pricing: "$150-$420/week",
    website: "https://apm.activecommunities.com/sfrecpark/"
  },
  {
    name: "SF Seals Soccer Camp",
    description: "SF Seals camps are designed for campers of all abilities from ages 4 to 15. Camps are designed for players to build their skills and have a fun time, in a positive environment.",
    location: "Beach Chalet or Crocker Amazon",
    ageRange: "Age 4 - 15",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "$375-$425/week",
    website: "https://www.sfseals.com/summercamps"
  },
  {
    name: "SF Shakespeare Camp",
    description: "Bay Area Shakespeare Camps offer students the opportunity to study Shakespeare's theatre in a fun, supportive atmosphere. Campers are taught by theatre practitioners who lead interactive classes in Shakespeare's poetry, clowning traditions, and stage combat.",
    location: "MacLaren Park",
    ageRange: "Age 7-18",
    dates: "July 6 - 30",
    hours: "9:00am - 3:00pm",
    pricing: "Register for Pricing",
    website: "https://sfshakes.org/bay-area-shakespeare-camp/"
  },
  {
    name: "SF Spanish",
    description: "Spanish Immersion camp.",
    location: "Fillmore",
    ageRange: "Age 6-10",
    dates: "Dates vary by grade",
    hours: "Vary by age and camp version",
    pricing: "Vary by age and camp version",
    website: "http://sfspanish.ning.com/"
  },
  {
    name: "SF United Soccer Camp",
    description: "SF United is committed to the development of youth soccer and provides a nurturing, positive and fun yet professional atmosphere. Our goal is for each kid to leave with a feeling of strong self-confidence and with a new sense of inspiration.",
    location: "Beach Chalet, Rossi Park and Margaret Haywood Park",
    ageRange: "Born 2008 - 2012",
    dates: "Register for Dates",
    hours: "Register for times",
    pricing: "Register for pricing",
    website: "https://www.sf-united.com/page/show/7903964-summer-camp-2024"
  },
  {
    name: "SF Vikings Soccer Camp",
    description: "SFVSC has grown soccer players through fun-filled days of soccer skill-building and free play for over 40 years. Nationally licensed coaches, former professionals, and college players lead our camp.",
    location: "Golden Gate Park",
    ageRange: "Age 4 - 12",
    dates: "July 6 - August 14",
    hours: "9:00am - 4:00pm or 9:00am - 12:00pm",
    pricing: "$350-$550/week",
    website: "https://sfvikings.org/club/summercamp"
  },
  {
    name: "SF Youth Theater",
    description: "Through improvisation, theatre games and a simple script, students will create a play to perform for friends and family.",
    location: "Mid-Market and Mission",
    ageRange: "Grades 1 - 12",
    dates: "June 16 - July 25",
    hours: "Vary by Camp",
    pricing: "Vary by Fee",
    website: "https://sfyouththeatre.org/summer"
  },
  {
    name: "SF Zoo Camp",
    description: "The San Francisco Zoo offers one of the most educational and entertaining summer day camp adventures in the Bay Area. Your child will go 'wild' while learning, playing and exploring at the San Francisco Zoo!",
    location: "Outer Parkside",
    ageRange: "Age 5-12",
    dates: "June 15 - August 7",
    hours: "9:00am - 3:30pm",
    pricing: "$500-$550/week",
    website: "https://www.sfzoo.org/zoo-camp/"
  },
  {
    name: "Sherith Israel Preschool Summer Camp",
    description: "Sherith Israel Preschool is excited to offer summer camp for kids ages 2-5 at our location in Pacific Heights. Camp is located in the preschool classrooms and Lafayette Park.",
    location: "Pacific Heights",
    ageRange: "Age 2-5",
    dates: "June 29 - July 31",
    hours: "8:30am - 12:30pm or 8:30am - 3:30pm",
    pricing: "Pricing Varies",
    website: "https://www.sherithisrael.org/summer-camp-enrollment.html"
  },
  {
    name: "SK8 GYM Skate Camp",
    description: "Skateboarding, Rollerskating and rollerblading camp.",
    location: "Aptos Park/Balboa Skatepark",
    ageRange: "Age 6-14",
    dates: "June 8 - August 14",
    hours: "9:00am - 3:00pm",
    pricing: "Prices Vary by Camp",
    website: "https://www.sk8gym.com/camp"
  },
  {
    name: "Soccer Insight",
    description: "Soccer Camp FUNdamentals for first timers and competitive players. AllSports as an option for all groups each day including tennis, basketball, football, hockey, soccer, kickball, nature walks, golf, baseball.",
    location: "Presidio",
    ageRange: "Age 4.5 - 13",
    dates: "June 8 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "$495/week",
    website: "https://soccerinsight.com/"
  },
  {
    name: "South Beach Yacht Club Sailing",
    description: "Basic/Intermediate Class: This camp introduces the fundamentals of sailing. Campers will learn essential safety and sailing skills, including boat handling, teamwork, wind principles, boat nomenclature, sailing terminology, and knot tying.",
    location: "South Beach/SOMA",
    ageRange: "Age 8-16",
    dates: "June 8 - August 14",
    hours: "9:00am - 4:00pm",
    pricing: "$700/week",
    website: "https://southbeachyachtclub.org/youth-sailing"
  },
  {
    name: "Spy Camp",
    description: "Every week at SpyCamp is packed with exciting games, hunts, labs, and real spy skill trainings. Cadets get completely original experiences like the giant outdoor board game of Urban Agent; they'll build and navigate a real laser maze.",
    location: "Hayes Valley and Potrero Hill",
    ageRange: "Age 6.5-10",
    dates: "June 8 - August 28",
    hours: "9:00am - 4:00pm",
    pricing: "$590/week",
    website: "http://adventurous.com/spycamp/"
  },
  {
    name: "Stemful",
    description: "Science, technology, engineering, arts, math (STEAM) camps. STEMful leads STEAM focused camps and classes. They offer creative curriculum on a wide range of fun themes/topics which change each year.",
    location: "Bernal Heights",
    ageRange: "Age 3.5-9.5",
    dates: "June 2 - August 29",
    hours: "9:00am - 3:00pm",
    pricing: "$690-$725/week",
    website: "https://sf-stemful.com/camps/"
  },
  {
    name: "Steve & Kate's Camp",
    description: "At Camp, kids take chances and take charge, shaping their day, their way. More choices and fewer expectations creates more possibilities, more self-trust and less self-doubt.",
    location: "Mission",
    ageRange: "Age 4 - 12",
    dates: "June 22 - August 14",
    hours: "8:00am - 6:00pm",
    pricing: "$115-$129/day",
    website: "http://steveandkatescamp.com/"
  },
  {
    name: "Stratford School",
    description: "Stratford infuses its STEAM curriculum into an innovative and enriching summer camp experience. Younger campers learn, explore, and engage in hands-on learning projects.",
    location: "Central Richmond, Ingleside, Mission Terrace and Parkside",
    ageRange: "PreK - 8th",
    dates: "June 3 - August 8",
    hours: "Various hours based on age",
    pricing: "Varies by hours & program",
    website: "https://www.stratfordschools.com/after-school/summer-camps/"
  },
  {
    name: "Stretch the Imagination",
    description: "Each summer we offer a variety of summer camps for children age 2-5.9 years old here at our school. We also run nature camps for children age 4-5.9 and K-3rd grade from 9-3:00pm in the Presidio forest.",
    location: "Pacific Heights and Presidio",
    ageRange: "Ages Vary by Camp",
    dates: "June 10 - August 16",
    hours: "Various hours based on age",
    pricing: "Varies by hours & program",
    website: "https://stretchtheimagination.com/"
  },
  {
    name: "Stuart Hall / Convent Camp",
    description: "Convent & Stuart Hall offers a balanced, K-8 coeducational summer program that combines discovery-based academic sessions with recreational afternoons rooted in performing arts, athletics, visual arts, creative design and science.",
    location: "Pacific Heights",
    ageRange: "K - 8th Grade",
    dates: "June 22 - July 17",
    hours: "Varies by camp",
    pricing: "Register for details",
    website: "https://www.sacredsf.org/the-experience/summer-program"
  },
  {
    name: "SummerGATE",
    description: "SummerGATE is a California non-profit educational corporation established for the purpose of providing college-bound students with challenging summer classes. Offering enriching summer classes and hands-on curriculum for Grades K-8.",
    location: "Outer Sunset and Parkmerced",
    ageRange: "K - 8th Grade",
    dates: "June 15 - August 7",
    hours: "8:45am - 4:30pm",
    pricing: "$1,200/Two Weeks",
    website: "https://www.summergatesf.org/"
  },
  {
    name: "Sunshine Art House",
    description: "At Sunshine Art House we are dedicated to helping students of all ages find their inner artist. We offer a wide range of mediums so students can explore the many aspects of art and find their favorite mode for creative expression.",
    location: "Inner Richmond",
    ageRange: "1st - 5th Grade",
    dates: "June 8 - August 21",
    hours: "9:00am - 3:00pm",
    pricing: "$583/week",
    website: "https://www.sunshinearthouse.com/"
  },
  {
    name: "Synergy School",
    description: "Day Camp offers classes in art, ceramics, cooking, science, drama, and sports, as well as excursions to museums, parks, and beaches. Tech Camp provides classes in robotics, Minecraft, video production, coding, tinkering, building, stop motion animation.",
    location: "Mission",
    ageRange: "K - 6th Grade",
    dates: "June 8 - August 14",
    hours: "8:15am - 3:00pm",
    pricing: "Prices Vary",
    website: "https://www.synergyschool.org/summer"
  },
  {
    name: "TechKnowHow",
    description: "Our camps teach students technology skills through fun, engaging and dynamic projects, many of which feature special LEGO components. From robotics to iPad movie-making, game design, and a tech week just for girls.",
    location: "Glen Park, Potrero and Sunset",
    ageRange: "Age 5 - 12",
    dates: "June 8 - August 7",
    hours: "9:00am - 3:30pm",
    pricing: "$550/week",
    website: "http://www.techknowhowkids.com/"
  },
  {
    name: "TechRevolution (Powered by Lavner Camps)",
    description: "50+ Cutting-Edge STEM iCamps. Proprietary Expert Curricula. Ivy League/Top-Tier Instructors. Camp Tech Revolution Online is filled with experiential, hands-on learning, collaboration, excitement, and cutting-edge topics in STEM.",
    location: "Park Merced",
    ageRange: "Age 6-14",
    dates: "June 15 - July 31",
    hours: "9:00am - 3:00pm",
    pricing: "Prices Vary by Camp",
    website: "https://www.lavnercampsandprograms.com/"
  },
  {
    name: "TEC REC Summer Camp",
    description: "Imagination, Engineering - Innovation is driving our world. Campers will have the opportunity to explore the process of taking an invention from creation to working model. Drones, Woodworking, Robotics, Arts & Crafts, Virtual Reality, and more!",
    location: "Richmond",
    ageRange: "Grade 1 - 8",
    dates: "June 16 - August 8",
    hours: "8:00am - 6:00pm",
    pricing: "$380-$450/session",
    website: "https://www.youthsf.org/summercamp"
  },
  {
    name: "Tenacious Tennis Academy",
    description: "Appropriate for all ages and levels. Players are evaluated and grouped accordingly. All of our coaches are certified or compete at a collegiate level.",
    location: "Park Merced",
    ageRange: "Age 4 -18",
    dates: "June 1 - August 21",
    hours: "Register for Details",
    pricing: "Register for Details",
    website: "https://www.tenacioustennis.com/summer-tennis-camps-junior-kids"
  },
  {
    name: "Terra Marin Earth Discovery Summer Camp",
    description: "Experience nature up close. Connect deeply with the environment, others, and self. Excursions will take your child from the beach to the mountains and everywhere in between to hike, learn and explore.",
    location: "Marin and San Francisco",
    ageRange: "Age 3 -10",
    dates: "Register for dates",
    hours: "Register for Details",
    pricing: "Register for Details",
    website: "https://www.terraschools.org/terra-camps"
  },
  {
    name: "Terra Marin Mandarin Mania Summer Camp",
    description: "This immersive and fun Mandarin camp is appropriate for all levels of Mandarin learners. Campers will learn to speak and read the Chinese language while exploring the customs, food, music, art, and dance of this wonderful culture.",
    location: "Mill Valley with SF shuttles available",
    ageRange: "Age 3 - 8",
    dates: "Register for dates",
    hours: "Register for Details",
    pricing: "Register for Details",
    website: "https://www.terraschools.org/terra-camps"
  },
  {
    name: "Terra Marin Spanish Immersion Summer Camp",
    description: "Get immersed in both nature and Spanish. Excursions will take your child from the beach to the mountains and everywhere in between to hike, explore and learn about the intricacies of the environment while absorbing a new language.",
    location: "Marin and San Francisco",
    ageRange: "Age 3 -10",
    dates: "Register for dates",
    hours: "Register for Details",
    pricing: "Register for Details",
    website: "https://www.terraschools.org/terra-camps"
  },
  {
    name: "Tinkering School",
    description: "An immersive, five-day building experience in the heart of San Francisco. Each week we welcome a new crew of Tinkerers and the project theme is always unique. Past projects: a 25ft tall dancing marionette, a NASA-style space mission, a human size foosball table.",
    location: "Presidio",
    ageRange: "Age 8 - 15",
    dates: "June 23 - August 8",
    hours: "9:00am - 3:30pm",
    pricing: "$675 - $775/week",
    website: "http://www.tinkeringschool.com/"
  },
  {
    name: "Tomodachi",
    description: "Children can participate in everything from athletic skill development to creative writing. Weekly Japanese cultural enrichment workshops and activities are offered. Field trips included: Discovery Kingdom, ice skating and the zoo.",
    location: "Lower Pacific Heights",
    ageRange: "Grades K - 9th",
    dates: "June 15 - August 7",
    hours: "8:00am - 5:30pm",
    pricing: "$320/week",
    website: "https://www.jcyc.org/child-development#tomodachi"
  },
  {
    name: "Treasure Island Sailing Camp",
    description: "Youth sailing classes with a variety of different options for classes. NO experience necessary! In addition to teaching children to sail in a fun, engaging, and safe way, we strive to instill character-building aspects.",
    location: "Treasure Island",
    ageRange: "Age 8 - 17",
    dates: "June 10 - August 2",
    hours: "9:00am - 4:00pm",
    pricing: "Vary By Camp",
    website: "https://www.tisailing.org/youth/"
  },
  {
    name: "Tree Frog Treks",
    description: "Campers at Tree Frog Treks Summer Camp get out and get dirty every day! Each camper builds a special connection to nature with the help of expert naturalists as they discover the world through science.",
    location: "Golden Gate Park, McLaren Park, Christopher Playground, Holly Park",
    ageRange: "K - 9th Grade",
    dates: "June 8 - August 21",
    hours: "9:00am - 2:30pm or 9:00am - 5:00pm",
    pricing: "$555-$795/week",
    website: "http://www.treefrogtreks.com/summer/"
  },
  {
    name: "Tutu School Ballet",
    description: "Imagine spending fun-filled camp days exploring the enchanted and enriching world of ballet! On any given day at Tutu Camp, a child might take a ballet class, decorate costumes, learn the story of a famous ballet.",
    location: "North Beach",
    ageRange: "Age 3-8",
    dates: "June 23 - July 3",
    hours: "9:00am - 2:00pm",
    pricing: "$463-$578/week",
    website: "https://www.tutuschool.com/sanfrancisco/camp"
  },
  {
    name: "US Sports Camp",
    description: "Baseball, Football, Basketball, Soccer, Softball, Volleyball camps.",
    location: "Various Locations",
    ageRange: "Age 5-18",
    dates: "June 8 - July 15",
    hours: "Vary by Camp",
    pricing: "Vary by Camp",
    website: "https://www.ussportscamps.com/search/results?q=San%20Francisco"
  },
  {
    name: "Wah Mei Summer Camp",
    description: "Wah Mei Summer Camp is a bilingual Chinese and English youth enrichment program. Activities include STEM projects, arts and crafts, games and songs, cooking lessons, swimming, field trips to museums, and an overnight camping trip.",
    location: "Inner Sunset",
    ageRange: "Grade 1 - 6",
    dates: "June 17 - August 9",
    hours: "8:30am - 5:30pm",
    pricing: "$1,350-$2,600",
    website: "https://www.wahmei.org/summer/"
  },
  {
    name: "Wheelhouse Clay Youth Art Camps",
    description: "Our Youth Summer Art Camps are designed to nurture curiosity and build confidence in each child. We will not only be creating with clay but also with other mediums such as paint, paper, craft wood, etc.",
    location: "Lower Pacific Heights",
    ageRange: "Age 6 - 16",
    dates: "June 8 - July 24",
    hours: "9:00am - 12:00pm or 9:30am - 12:30pm",
    pricing: "$395",
    website: "https://www.wheelhouseclaysf.com/youthprograms"
  },
  {
    name: "Wheel Kids Bicycle Club",
    description: "Adventure Riding Camp: Advanced on- and off-road rides for avid riders who seek thrills and adventure. Camp Cruisin: A great camp for anyone who loves exploring and having fun on their bike. Two Wheelers: For total beginners, learn to ride on two wheels.",
    location: "Central Richmond, Sunset and Dogpatch",
    ageRange: "Grade K-7",
    dates: "June 8 - August 24",
    hours: "8:30am - 4:00pm",
    pricing: "Vary by Camp",
    website: "http://wheelkids.com/san-francisco/"
  },
  {
    name: "Yerba Buena Skate Bowl Camp",
    description: "SkateBowl camp is a specialty day camp for children who either love bowling and/or ice skating or want to learn more about those activities. No previous experience in either sport is needed; first-time beginners are warmly welcomed.",
    location: "SOMA",
    ageRange: "Age 7-12",
    dates: "June 16 - August 15",
    hours: "8:30am - 5:30pm",
    pricing: "$580/week",
    website: "https://www.skatebowl.com/pages/summercamp"
  },
  {
    name: "YMCA Summer Camp",
    description: "YMCA day camps offer everything you can think of when you think of camp in the heart of the city. We focus on hands-on experiences, arts, media, and challenges that make learning fun. Field trips, arts & crafts, camp songs, and organized games.",
    location: "Multiple SF locations",
    ageRange: "K - 12th Grade",
    dates: "Varies by location",
    hours: "7:30am - 6:00pm",
    pricing: "$200-$450/week",
    website: "https://www.ymcasf.org/"
  },
  {
    name: "Zaccho Center for Dance and Aerial Arts",
    description: "Join us for one action-packed week of off-the-ground creativity, discovery and community. During the week your child will be introduced to aerial arts, dance/theatre, and collaborative games with a final performance.",
    location: "Bayview",
    ageRange: "Age 7 - 11",
    dates: "July 11 - 15",
    hours: "9:00am - 3:00pm",
    pricing: "$500",
    website: "http://zaccho.org/?cdaa_sawyer-youth"
  }
];

function parseAgeRange(ageRange: string): { min: number; max: number } {
  // Try to extract numbers from strings like "Age 4 - 12", "Ages 4-12", "K - 5th Grade", etc.
  const numbers = ageRange.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    return { min: parseInt(numbers[0]), max: parseInt(numbers[1]) };
  } else if (numbers && numbers.length === 1) {
    return { min: parseInt(numbers[0]), max: 18 }; // Default max to 18
  }

  // Handle grade-based ranges (K=5, 12th=18)
  if (ageRange.toLowerCase().includes('k')) {
    return { min: 5, max: 18 };
  }

  // Default ages for typical summer camps
  return { min: 5, max: 14 };
}

function parseHours(hours: string): { start: string | null; end: string | null } {
  // Try to extract times like "9:00am - 3:00pm"
  const timeMatch = hours.match(/(\d{1,2}:\d{2})\s*(am|pm)?\s*[-–]\s*(\d{1,2}:\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    let startHour = timeMatch[1];
    const startPeriod = timeMatch[2]?.toLowerCase() || 'am';
    let endHour = timeMatch[3];
    const endPeriod = timeMatch[4]?.toLowerCase() || 'pm';

    // Convert to 24-hour format
    const convertTo24 = (time: string, period: string) => {
      const [h, m] = time.split(':').map(Number);
      let hour = h;
      if (period === 'pm' && h !== 12) hour += 12;
      if (period === 'am' && h === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    return {
      start: convertTo24(startHour, startPeriod),
      end: convertTo24(endHour, endPeriod)
    };
  }
  return { start: null, end: null };
}

function parsePricing(pricing: string): { min: number | null; max: number | null } {
  // Extract dollar amounts
  const amounts = pricing.match(/\$[\d,]+/g);
  if (amounts) {
    const numbers = amounts.map(a => parseInt(a.replace(/[$,]/g, '')));
    if (numbers.length >= 2) {
      return { min: Math.min(...numbers), max: Math.max(...numbers) };
    } else if (numbers.length === 1) {
      return { min: numbers[0], max: numbers[0] };
    }
  }
  return { min: null, max: null };
}

async function seedCamps() {
  console.log(`Starting camp seeding... (${camps.length} camps)`);

  let successCount = 0;
  let errorCount = 0;

  for (const camp of camps) {
    const ages = parseAgeRange(camp.ageRange);
    const hours = parseHours(camp.hours);
    const pricing = parsePricing(camp.pricing);

    // Include hours info in description if available
    const fullDescription = hours.start && hours.end
      ? `${camp.description}\n\nHours: ${hours.start} - ${hours.end}`
      : camp.description;

    const programData = {
      name: camp.name,
      description: fullDescription,
      category: ['Summer Camp'],
      age_min: ages.min,
      age_max: ages.max,
      price_min: pricing.min,
      price_max: pricing.max,
      price_unit: 'week',
      provider_name: camp.name,
      provider_website: camp.website,
      status: 'active' as const,
      google_review_count: 0,
    };

    console.log(`Inserting: ${camp.name}`);

    const { data, error } = await supabase
      .from('programs')
      .insert(programData)
      .select()
      .single();

    if (error) {
      console.error(`Error inserting ${camp.name}:`, error.message);
      errorCount++;
      continue;
    }

    successCount++;

    // Add location
    if (data) {
      const { error: locError } = await supabase
        .from('program_locations')
        .insert({
          program_id: data.id,
          address: camp.location + ', San Francisco, CA',
          neighborhood: camp.location.split(',')[0].split('and')[0].trim(),
          latitude: 37.7749, // Default SF coords - would need geocoding for accuracy
          longitude: -122.4194,
          is_primary: true,
        });

      if (locError) {
        console.error(`Error inserting location for ${camp.name}:`, locError.message);
      }
    }
  }

  console.log(`\nCamp seeding complete!`);
  console.log(`Success: ${successCount}, Errors: ${errorCount}`);
}

seedCamps().catch(console.error);
