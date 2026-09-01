export type Train = {
  number: string;
  name: string;
  nameBn: string;
  from: string;
  to: string;
  progress: number;
  delay: number;
  status: "Running" | "Scheduled";
  nextStation: string;
  eta: string;
  speed: number;
};

export const trains: Train[] = [
  {number:"705",name:"Ekota Express",nameBn:"একতা এক্সপ্রেস",from:"Dhaka",to:"Panchagarh",progress:43,delay:18,status:"Running",nextStation:"Tangail",eta:"18:05",speed:71},
  {number:"781",name:"Kishoreganj Express",nameBn:"কিশোরগঞ্জ এক্সপ্রেস",from:"Dhaka",to:"Kishoreganj",progress:88,delay:12,status:"Running",nextStation:"Kishoreganj",eta:"16:55",speed:54},
  {number:"735",name:"Agnibina Express",nameBn:"অগ্নিবীণা এক্সপ্রেস",from:"Dhaka",to:"Tarakandi",progress:65,delay:30,status:"Running",nextStation:"Jamalpur",eta:"17:20",speed:62},
  {number:"813",name:"Cox's Bazar Express",nameBn:"কক্সবাজার এক্সপ্রেস",from:"Dhaka",to:"Cox's Bazar",progress:24,delay:21,status:"Running",nextStation:"Comilla",eta:"20:40",speed:78},
  {number:"753",name:"Silk City Express",nameBn:"সিল্কসিটি এক্সপ্রেস",from:"Dhaka",to:"Rajshahi",progress:12,delay:8,status:"Running",nextStation:"Dhaka Airport",eta:"19:15",speed:69},
  {number:"717",name:"Jayentika Express",nameBn:"জয়ন্তিকা এক্সপ্রেস",from:"Dhaka",to:"Sylhet",progress:45,delay:16,status:"Running",nextStation:"Bhairab Bazar",eta:"18:55",speed:65}
];

export const stations = [
  {code:"DHA",name:"Dhaka",nameBn:"ঢাকা"},
  {code:"TGI",name:"Tangail",nameBn:"টাঙ্গাইল"},
  {code:"JAM",name:"Jamalpur",nameBn:"জামালপুর"},
  {code:"MYM",name:"Mymensingh",nameBn:"ময়মনসিংহ"},
  {code:"KSH",name:"Kishoreganj",nameBn:"কিশোরগঞ্জ"},
  {code:"CTG",name:"Chattogram",nameBn:"চট্টগ্রাম"},
  {code:"SYL",name:"Sylhet",nameBn:"সিলেট"},
  {code:"COX",name:"Cox's Bazar",nameBn:"কক্সবাজার"},
  {code:"RAJ",name:"Rajshahi",nameBn:"রাজশাহী"}
];

export function getTrain(number:string){return trains.find(t=>t.number===number);}
