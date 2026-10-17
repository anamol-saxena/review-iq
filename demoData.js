// ============================================================
// Universal Review Analyzer — Demo Data
// 6 preloaded scenarios for hackathon demonstration
// ============================================================

const DEMO_SCENARIOS = {
  hotel_goa: {
    id: "hotel_goa",
    name: "Taj Exotica Resort, Goa",
    domain: "hotel",
    icon: "🏨",
    description: "Luxury beach resort",
    source: "TripAdvisor (mock)",
    reviews: [
      { id: 1, text: "Absolutely stunning property! The beach view from our room was breathtaking. Staff went above and beyond — they arranged a surprise anniversary setup on the beach. Food quality at the restaurant was exceptional, especially the seafood. Only minor issue: the WiFi was spotty in our room.", date: "2024-11-15", rating: 5, author: "Priya S.", lang: "en" },
      { id: 2, text: "Beautiful resort but extremely overpriced. Paid ₹35,000 per night for a sea-view room. The room itself was gorgeous, beds super comfortable. But AC was noisy and the pool was crowded with non-guests. Service was slow at breakfast.", date: "2024-10-22", rating: 3, author: "Rahul M.", lang: "en" },
      { id: 3, text: "Perfect honeymoon destination. The in-room Jacuzzi was a dream. We loved the private beach section — felt very exclusive. Staff remembered our names throughout. The spa was world-class. Would give 6 stars if I could.", date: "2024-09-10", rating: 5, author: "Anjali & Dev", lang: "en" },
      { id: 4, text: "Great location right on the beach. Room was clean and spacious. The evening cultural program was lovely. However, the Wi-Fi was terrible — could barely load emails. Also, the elevator was under maintenance for 2 days.", date: "2024-08-03", rating: 4, author: "Thomas K.", lang: "en" },
      { id: 5, text: "Inconsistent service. When we arrived, the check-in took 45 minutes. Our room wasn't ready despite late check-in time. The bellhop was rude when we pointed this out. Pool and beach are gorgeous though. Sunrise view is unmatched.", date: "2024-07-18", rating: 3, author: "Sneha P.", lang: "en" },
      { id: 6, text: "Stayed during peak season. The resort was overbooked and it showed. Restaurant waiting time was 1 hour. Beach chairs were always taken. But the infrastructure itself — rooms, gym, spa — are genuinely 5-star quality.", date: "2024-06-12", rating: 3, author: "Vikram N.", lang: "en" },
      { id: 7, text: "We've stayed at many Taj properties and this is among the best. The food is incredible — try the Sunday brunch. Staff is highly trained. Small gripe: parking was difficult and valet was slow on weekends.", date: "2024-04-28", rating: 5, author: "Nisha J.", lang: "en" },
      { id: 8, text: "The resort looks amazing in photos but reality was disappointing. The beachfront was rocky, not sandy like advertised. Room service was delayed by 40+ minutes multiple times. Overpriced for what you get.", date: "2024-03-15", rating: 2, author: "Arun T.", lang: "en" },
      { id: 9, text: "Truly a 5 star experience. Everything from the welcome drink to the checkout was flawless. The location is unbeatable. The sunset from the infinity pool is something you'll never forget. WiFi works fine in the lobby.", date: "2024-02-20", rating: 5, author: "Meera S.", lang: "en" },
      { id: 10, text: "मेरे परिवार के साथ शानदार अनुभव था। होटल का वातावरण बहुत सुंदर है। खाना बहुत अच्छा था, विशेषकर समुद्री भोजन। स्टाफ बहुत मददगार था। WiFi थोड़ी धीमी थी।", date: "2024-01-10", rating: 5, author: "Ramesh G.", lang: "hi" },
      { id: 11, text: "Great experience overall. Beach is private and clean. Room amenities are top notch. The morning yoga session on the beach was a highlight. Bit expensive but worth it for special occasions.", date: "2023-12-25", rating: 4, author: "Claire B.", lang: "en" },
      { id: 12, text: "Good resort but not exceptional for the price. We stayed at the Leela in Goa and felt it offered better value. Taj brand premium doesn't always translate to proportionately better experience.", date: "2023-11-08", rating: 3, author: "Gautam R.", lang: "en" },
      { id: 13, text: "The spa is worth every rupee. Got a traditional Ayurvedic massage and felt completely rejuvenated. Beach was cleaner than expected for peak tourist season. Only issue — no vegetarian options at the beachside grill.", date: "2023-09-14", rating: 4, author: "Kavita L.", lang: "en" },
      { id: 14, text: "Pool was dirty with leaves and debris for two consecutive days. Reported it at front desk but nothing was done. For this price point, housekeeping of public areas should be impeccable.", date: "2023-07-22", rating: 2, author: "Siddharth V.", lang: "en" },
      { id: 15, text: "One of the most romantic places I've been. The candlelit dinner on the beach they arranged for us was magical. Staff truly made the trip. Location is perfect — 10 mins from Colva beach.", date: "2023-05-30", rating: 5, author: "Pooja & Arjun", lang: "en" },
    ]
  },

  headphones_sony: {
    id: "headphones_sony",
    name: "Sony WH-1000XM5 Headphones",
    domain: "electronics",
    icon: "🎧",
    description: "Premium ANC headphones",
    source: "Amazon India (mock)",
    reviews: [
      { id: 1, text: "Best noise cancelling I've ever tried. Took these on a Mumbai-London flight and couldn't hear the engines at all. Sound quality is incredible — bass is deep, mids are clear. Battery lasts me 2 full work days. Build feels premium.", date: "2024-11-20", rating: 5, author: "Aryan K.", lang: "en" },
      { id: 2, text: "ANC is top notch but sound is a bit bass heavy for my taste. I prefer flat EQ for mixing music and the default tuning is too colored. The Sony app helps somewhat but it's still not neutral enough.", date: "2024-10-30", rating: 4, author: "DJ Aarav", lang: "en" },
      { id: 3, text: "Comfortable for long sessions but they don't fold flat anymore which is annoying for travel. The case is also bigger than the XM4. Sound is excellent. Mic quality on calls is crisp — no complaints about voice clarity.", date: "2024-10-05", rating: 4, author: "Samira H.", lang: "en" },
      { id: 4, text: "Bought these for ₹29,990. After 8 months the hinge cracked on the right earcup. Sony service center was unhelpful about warranty. Sound quality is 10/10 but build durability is a serious concern.", date: "2024-09-12", rating: 2, author: "Nikhil D.", lang: "en" },
      { id: 5, text: "Amazing headphones. The speak-to-chat feature is very handy in the office. Battery is 30+ hours which matches the claim. The LDAC codec makes a noticeable difference in music quality. My go-to recommendation for anyone in the ₹25K+ range.", date: "2024-08-25", rating: 5, author: "Ananya R.", lang: "en" },
      { id: 6, text: "Sound quality is undeniably great. But competing with AirPods Max in 2024, Apple's spatial audio and ecosystem integration are tough to beat for iPhone users. Sony wins on pure audio, Apple on ecosystem.", date: "2024-07-18", rating: 4, author: "Rohan A.", lang: "en" },
      { id: 7, text: "The touch controls are overly sensitive. I constantly skip songs when I'm adjusting the fit. I wish there were physical buttons like the XM3. ANC is great, sound is great, but UX could be improved.", date: "2024-06-22", rating: 3, author: "Priyanka S.", lang: "en" },
      { id: 8, text: "These headphones changed how I work from home. ANC blocks out my kids completely. I can finally focus! Sound signature is warm and lush. Multipoint Bluetooth works well — I switch between laptop and phone seamlessly.", date: "2024-05-15", rating: 5, author: "Deepak M.", lang: "en" },
      { id: 9, text: "Returned after 3 days. The earcups cause a lot of pressure on my ears. I have smaller ears and these just didn't fit well. Became painful after 1.5 hours. Went back to my Jabra Evolve 65 instead.", date: "2024-04-08", rating: 2, author: "Tanu P.", lang: "en" },
      { id: 10, text: "10/10 for ANC. 10/10 for battery. 9/10 for sound. 6/10 for build quality (too much plastic for this price). Overall still the best wireless ANC on the market. Would recommend to frequent flyers and remote workers.", date: "2024-03-30", rating: 4, author: "Kabir J.", lang: "en" },
      { id: 11, text: "The companion app is filled with bloatware and ads. Why is Sony pushing a subscription service for EQ presets? The hardware is excellent but the software experience feels exploitative.", date: "2024-02-14", rating: 3, author: "Tech Reviewer X", lang: "en" },
      { id: 12, text: "Superb for commuting. The noise from the Metro is completely isolated. Audio quality is top class. Comfortable for 4-5 hours. After 6 hours my ears start to feel warm. Minor issue but worth noting.", date: "2024-01-20", rating: 4, author: "Lavanya K.", lang: "en" },
      { id: 13, text: "Not for audiophiles. The DSP processing introduces artifacts at high volume. The XM5 is a consumer-grade headphone, not a monitor. If you just want to enjoy music without analyzing it, it's incredible. If you're picky about accuracy, look elsewhere.", date: "2023-11-10", rating: 3, author: "Audiophile Mohan", lang: "en" },
      { id: 14, text: "My third Sony XM series. Each generation has been a genuine upgrade. The XM5 ANC is leaps ahead of the XM3. If you're deciding between XM4 and XM5, the XM5 wins on ANC, comfort, and call quality.", date: "2023-10-05", rating: 5, author: "Suresh P.", lang: "en" },
    ]
  },

  restaurant_bangalore: {
    id: "restaurant_bangalore",
    name: "Toit Brewpub, Bangalore",
    domain: "restaurant",
    icon: "🍺",
    description: "Craft beer & food",
    source: "Zomato (mock)",
    reviews: [
      { id: 1, text: "Best craft beer in Bangalore! The Bewitched Blonde is my favorite. Food is above average pub grub — try the nachos and the fish and chips. Always packed on weekends so book in advance.", date: "2024-11-25", rating: 5, author: "Rishi B.", lang: "en" },
      { id: 2, text: "Waited 1.5 hours for a table despite having a reservation. Staff apologized but the wait was unreasonable. Once seated, service was good and food was tasty. Beers are definitely worth trying. But the wait time ruins the experience.", date: "2024-11-10", rating: 3, author: "Nandini K.", lang: "en" },
      { id: 3, text: "Great ambiance — industrial chic look with exposed brick and huge brewing tanks visible. The nachos were phenomenal. Tried 4 different beers — all excellent. Pricing is reasonable for the quality. Noise level is high though.", date: "2024-10-18", rating: 4, author: "Vikrant M.", lang: "en" },
      { id: 4, text: "Overrated in my opinion. Beer is good but not extraordinary. Food was mediocre — the burger patty was dry and bland. For ₹2500 for two, I expect better. The hype doesn't match the reality anymore.", date: "2024-09-28", rating: 2, author: "Kritika S.", lang: "en" },
      { id: 5, text: "One of those places every Bangalorean must visit. The energy is electric on Friday nights. Beer quality is consistently high. The in-house brews are fresh and interesting. Parking is a nightmare though.", date: "2024-09-05", rating: 5, author: "Aaditya L.", lang: "en" },
      { id: 6, text: "Visited on a Tuesday evening — perfect. No wait, attentive staff, fresh beer. The chicken wings were crispy and well-seasoned. Loved the open-plan layout. Will avoid weekends though — too chaotic.", date: "2024-08-22", rating: 4, author: "Madhuri P.", lang: "en" },
      { id: 7, text: "Service has gone downhill. Used to come here 2-3 years ago and it was immaculate. Now the staff seems overwhelmed, the menu quality has dropped. Beer is still good but the food has become inconsistent.", date: "2024-08-01", rating: 3, author: "Sudhir N.", lang: "en" },
      { id: 8, text: "The brewery tour they sometimes offer is amazing — learning about the brewing process while sipping a fresh pint is a unique experience. Food is solid. Recommend the pulled pork sliders.", date: "2024-07-14", rating: 5, author: "Tanmay R.", lang: "en" },
      { id: 9, text: "Vegetarian options are very limited. As a vegetarian, I found only 3-4 items I could eat. The mushroom risotto was decent but the resto should expand its veg menu significantly for Bangalore's largely vegetarian crowd.", date: "2024-06-30", rating: 3, author: "Sunita V.", lang: "en" },
      { id: 10, text: "Came for a birthday dinner — made it special without us even asking. The staff brought a small dessert with a candle. The beer sampler was a great choice for a group trying to pick favorites. Good value.", date: "2024-06-10", rating: 5, author: "Roshan F.", lang: "en" },
      { id: 11, text: "ಬೀರ್ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ. ಆಹಾರ ಸ್ವಲ್ಪ ದುಬಾರಿಯಾಗಿದೆ ಆದರೆ ಗುಣಮಟ್ಟ ಚೆನ್ನಾಗಿದೆ. ಸ್ಥಳ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ.", date: "2024-05-20", rating: 4, author: "Charan K.", lang: "kn" },
      { id: 12, text: "Noise levels are brutal on weekends. Can't hear your friends talk. Had to shout over the music. Love the beer, love the food, hate the acoustics. This is a recurring complaint — why hasn't it been addressed?", date: "2024-04-12", rating: 3, author: "Aparna G.", lang: "en" },
    ]
  },

  laptop_dell: {
    id: "laptop_dell",
    name: "Dell XPS 15 (2024)",
    domain: "electronics",
    icon: "💻",
    description: "Premium Windows laptop",
    source: "Flipkart (mock)",
    reviews: [
      { id: 1, text: "Display is absolutely gorgeous — the OLED panel is color-accurate and incredibly bright. Performance with the i9 processor is blazing fast. Thermal management is the only weakness; it gets hot under sustained load.", date: "2024-10-15", rating: 5, author: "Siddharth P.", lang: "en" },
      { id: 2, text: "Battery life is a disaster. Getting barely 4-5 hours on moderate tasks. For a premium laptop this is unacceptable. The display is magnificent and performance is great but I need a laptop that lasts through a workday.", date: "2024-09-20", rating: 3, author: "Aditi L.", lang: "en" },
      { id: 3, text: "Keyboard is one of the best I've typed on. Trackpad is responsive and accurate. Build quality feels tank-like. Runs heavy video editing tasks without breaking a sweat. The fan noise under load is louder than I'd like.", date: "2024-08-18", rating: 4, author: "Creative Harish", lang: "en" },
      { id: 4, text: "Spent ₹1.8 lakhs on this and the screen started flickering after 6 months. Dell support has been slow to respond. Premium price should come with premium after-sales service. Deeply disappointed.", date: "2024-07-25", rating: 1, author: "Neha R.", lang: "en" },
      { id: 5, text: "This is my daily driver for software development. Runs multiple Docker containers, VMs, and IDEs simultaneously without a hiccup. Linux compatibility is excellent. The only laptop I've used where I forget the hardware exists.", date: "2024-06-30", rating: 5, author: "Dev Karan", lang: "en" },
      { id: 6, text: "Thermals throttle performance significantly. During a 30-minute video render, the CPU drops from 5GHz to 2.8GHz due to heat. The thin chassis doesn't allow adequate cooling. For creative workloads, consider an alternatives.", date: "2024-05-14", rating: 3, author: "Video Pro Raj", lang: "en" },
      { id: 7, text: "Perfect replacement for my aging MacBook Pro. Windows 11 has come a long way. The build quality rivals Apple — CNC aluminum chassis feels premium. Speakers are excellent for a Windows laptop. Happy with the purchase.", date: "2024-04-08", rating: 5, author: "Sundar K.", lang: "en" },
      { id: 8, text: "The bloatware Dell preinstalls is embarrassing for a premium product. Took me 2 hours to clean install Windows and remove all the junk. After that, it's genuinely excellent. But you shouldn't have to do that.", date: "2024-03-22", rating: 4, author: "Tech Savvy Ritu", lang: "en" },
    ]
  },

  airbnb_kerala: {
    id: "airbnb_kerala",
    name: "Treehouse Stay, Munnar",
    domain: "hotel",
    icon: "🌿",
    description: "Eco treehouse in tea gardens",
    source: "Airbnb (mock)",
    reviews: [
      { id: 1, text: "Most magical experience of my life! Woke up to mist rolling over the tea gardens. The treehouse is simple but charming. The host — Rajan — is incredibly warm and knowledgeable about the area. Helped us plan the perfect itinerary.", date: "2024-11-28", rating: 5, author: "Elena W.", lang: "en" },
      { id: 2, text: "The location is stunning but the facilities are rustic to the point of being uncomfortable. The bathroom had no hot water despite being listed as an amenity. The mattress was thin. Beautiful for Instagram, uncomfortable for sleeping.", date: "2024-10-30", rating: 2, author: "Prateek A.", lang: "en" },
      { id: 3, text: "You get what you pay for — a unique nature experience, not a 5-star hotel. The sunrise from the treehouse deck is once-in-a-lifetime. Rajan's homemade breakfast using local spices was delicious. Highly recommend for adventurous couples.", date: "2024-09-22", rating: 5, author: "Simone F.", lang: "en" },
      { id: 4, text: "WiFi was non-existent despite being listed. I was working remotely and this completely disrupted my plans. The host was apologetic but couldn't fix it. The nature aspect is wonderful, just be prepared to fully disconnect.", date: "2024-08-14", rating: 3, author: "Remote Worker Dev", lang: "en" },
      { id: 5, text: "Visited during monsoon — the property transforms into something otherworldly. Clouds literally pass through the treehouse deck. The host made Kerala tea and fresh banana fritters. We extended our stay by 2 days.", date: "2024-07-08", rating: 5, author: "Rachna & Vikas", lang: "en" },
      { id: 6, text: "Good experience but the access road is dangerously narrow. Our sedan got stuck and we had to call the host for help. Recommend bringing a small SUV or using host's referral driver service.", date: "2024-05-19", rating: 3, author: "Rohit K.", lang: "en" },
    ]
  },

  watch_samsung: {
    id: "watch_samsung",
    name: "Samsung Galaxy Watch 7",
    domain: "electronics",
    icon: "⌚",
    description: "Smartwatch with health tracking",
    source: "Amazon (mock)",
    reviews: [
      { id: 1, text: "Exceptional health tracking features. The sleep tracking is incredibly detailed and accurate — it even detected my sleep apnea episodes. The body composition measurement is surprisingly accurate compared to professional equipment.", date: "2024-11-15", rating: 5, author: "Fitness Neha", lang: "en" },
      { id: 2, text: "Battery is a step back from Galaxy Watch 6. Getting only 28 hours with always-on display enabled. If you're a heavy user you're charging every night. The health sensors are great but battery anxiety is real.", date: "2024-10-28", rating: 3, author: "Gaurav T.", lang: "en" },
      { id: 3, text: "Locked into Samsung ecosystem is the biggest downside. Half the features don't work with non-Samsung Android phones. If you have a Samsung phone it's phenomenal. For everyone else, look at Google Pixel Watch instead.", date: "2024-10-08", rating: 3, author: "Android User M.", lang: "en" },
      { id: 4, text: "The rotating bezel is so satisfying to use. Watch feels premium on the wrist. Navigation is intuitive. The Exynos W1000 chip is noticeably faster than previous generations. Genuinely snappy experience.", date: "2024-09-18", rating: 5, author: "Gaurav R.", lang: "en" },
      { id: 5, text: "Accurate GPS tracking for runs and cycling. The workout detection is smart — it automatically detected my swim and started tracking. Waterproofing is excellent — wore it snorkeling with no issues.", date: "2024-08-25", rating: 5, author: "Triathlete Aisha", lang: "en" },
      { id: 6, text: "Overheats during outdoor workouts in summer. The watch went into overheat protection mode during a 5K run on a 38°C day and paused heart rate monitoring. This is a safety issue for athletes training in hot conditions.", date: "2024-07-30", rating: 2, author: "Runner Pradeep", lang: "en" },
      { id: 7, text: "Wear OS 5 is a huge improvement. App selection is finally decent. Google Maps on the watch is great for navigation. The Gemini integration (Ask on watch) is genuinely useful. Overall a well-rounded smartwatch.", date: "2024-07-10", rating: 4, author: "Wearable Expert J.", lang: "en" },
    ]
  }
};
