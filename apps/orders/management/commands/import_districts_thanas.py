import re
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.orders.models import District, Thana

RAW_DATA = """
Bagerhat (10)
Bagerhat sadar
Chitalmari
Fakirhat
Kachua upazila
Mollahat
Mongla
Morrelganj
Rampal
Sarankhola
test thana
Bandarban (7)
Ali Kadam
Bandarban sadar
Lama
Naikhongchari
Rowangchhari
Ruma
Thanchi
Barguna (6)
Amtali
Bamna
Barguna sadar
Betagi
Patharghata
Taltali
Barishal (10)
Agailjhara
Babuganj
Bakerganj
Banaripara
Barishal Sadar
Gouronadi
Hizla
Mehendiganj
Muladi
Wazirpur
Bhola (7)
Bhola Sadar
Borhanuddin
Char fasso
Daulatkhan
Lalmohan
Manpura
Tazumuddin
Bogra (13)
Alamdighi
Baropur (Bogura)
Bogura Sadar
Dhunat
Dhupchancia
Gabtoli
Kahaloo
Nandigram
Saraikandi
Shajahanpur
Sherpur
Shibganj
Sonatola
Brahmanbaria (11)
Akhaura
Ashuganj
Bancharampur
Bijoynagar
Brahmanbaria Sadar
Kasba
Nabinagar
Nasirnagar
Null
Radhika (B Baria)
Sarail
Chandpur (9)
Chandpur Sadar
Dhakirgaon
Faridganj
Haimchar
Hajiganj
Kachua
Matlab North
Motlab dokkhin
Shahrasti
Chapainawabganj (5)
Bholahat
Chapainawabganj sadar
Gomastapur
Nachole
Shibganj
**Chittagong ** (38)
Akbar Shah
Anwara
Bakolia
Bandar - CTG
Banskhali
Bayazid Bostami
Bhujpur
Boalkhali
CEPZ
Chandanaish
Chandgaon
Chawk Bazar
Chittagong Sadar
Doublemooring
Fatikchori
Halishahar
Hathazari
Karnaphuli
KeraniHat
Khulshi
Kotwali - CTG
Lohagara
Mirsharai
Pahartali
Panchlaish
Patenga
Patiya
Rangunia
Raozan
Sadarghat - CTG
Sandwip
Satkania
shantirhat (patiya)
Shantirhat (Patiya)-CTG
Sitakunda
Sitakunda (Citygate)
Zorarganj
কেরানীহাট
Chuadanga (5)
Alamdanga
Chuadanga Sadar
Damurhuda
Darshana
Jibannagar
Cox's Bazar (9)
Chakaria
Cox's Bazar Sadar
Eidgaon
Kutubdia
Moheskhali
Pekua
Ramu
Teknaf, টেকনাফ
Ukhiya
Cumilla (19)
Bangora-Bazar
Barura
Brahmanpara
Burichang
Chandina
Chauddagram
Cumilla Sadar South Model
Daudkandi
Debidwar
Homna
Kandirpar
Kotwali Model
Laksam
Lalmai
Meghna
Monoharganj
Muradnagar
Nangalkot
Titas
Dhaka City (60)
Adabor
Airport
Ati Bazar (Keraniganj)
Azompur
Badda
Banani
Bangshal
Bashundhara R/A
Battery Section
Bhashantek
Cantonment
Chalkbazar
Dakshin khan
Darus Salam
Demra
Dhanmondi
Gandaria
Gulistan
Gulshan
Hatirjheel
Hazaribag
Jattrabari
Kadamtali
Kadamtali
Kafrul
Kalabagan
Kalabagan
Kamrangirchar
Khilgaon
Kotwali
Lalbagh
Mirpur
Mohammadpur
Motijheel
Mugda
New Market
Pallabi
Paltan
Panthapath
Purbachal
Ramna
Rampura
Rupnagar
Sabujbag
Shah Ali
Shah Ali Market
Shahbag
Shahjahanpur
Sher-e-Bangla Nagar
Shyampur
Sutrapur
Tejgaon
Tejgaon Industrial Area
Turag
Uttara
Uttarkhan
Vasantek
Vatara
Wari
Zone Not Clear
Dhaka Sub-Urban (8)
Ashulia
Dhamrai
Dohar
Hemayetpur
Keraniganj Model
Nawabganj
Savar
South Keraniganj
Dinajpur (14)
Biral
Birampur
Birganj
Bochaganj
Chirirbandar
Dinajpur Sadar
Fulbari //ফুলবাড়ি
Ghoraghat
Hakimpur
Kaharole
Khansama
Khulahati
Nawabganj Upazila
Parbatipur
Faridpur (10)
Alfadanga
Bhanga
Boalmari
Charbhadrasan
Faridpur
Faridpur Sadar
Madhukhali
Nagarkanda
Sadarpur
Shaltha
Feni (7)
Chagalnaiya
Dagunbhuiyan
Feni sadar
Fulgazi
Mohipal
Parshuram
Sonagazi
Gaibandha (8)
Dariapur
Fulchari
Gabindaganj
Gaibandha Sadar
Palashbari
Sadullapur
Saghata
Sundarganj
Gazipur (9)
Gazipur Sadar
Joydebpur
Kaliakair Upazila
Kaliganj upazila
kapasia
Kashimpur
Rajendrapur
Sreepur
Tongi
Gopalganj (6)
Boultali
Gopalganj Sadar
kasiani
Kotalipara
Muksudpur
tungipara
Habiganj (10)
Ajmiriganj
Bahubal
Baniachong
Chunarughat
Habiganj Sadar
Lakhai
Madhobpur
Nabiganj
Null
Shayestaganj
Jamalpur (8)
Baksiganj
Dewanganj
Islampur
Jamalpur Sadar
Madarganj
Melandaha
Nandina
Sarishabari
Jashore (8)
Abhaynagar
Bagharpara
Chaugacha
Jashore Sadar
jhikorgacha
keshobpur
Manirampur
Sharsha
Jhalokati (4)
Jhalokati sadar
Kathalia
Nalchity
Rajapur
Jhenaidah (6)
Harinakunda
Jhenaidah Sadar
Kaliganj
Kotchandpur
Maheshpur
Shailkupa
Joypurhat (5)
Akkelpur
Joypurhat Sadar
Kalai
Khetlal
Panchbibi
Khagrachori (9)
Dighinala
Guimara
khagrachari sadar
Laxmichari
Mahalchari
Manikchari
Matiranga
Panchari
Ramgarh
Khulna (14)
Batiaghata
Circuit House
Dacope
Daulatpur (Khulna)
Dighalia
Dumuria
Gollamari (Khulna)
Khulna Sadar
Koyra
Mujgunni
Paikgacha
Phultala
Rupsha
Terokhada
Kishoreganj (13)
Austagram
Bajitpur
Bhairab
Hossainpur
Itna
Karimganj
Katiadi
kishoreganj Sadar
Kuliarchar
Mithamain
Nikli
Pakundia
Tarail
Kurigram (11)
Bhurungamari
Char Rajibpur
Chilmari
fulbari
Kachakata
kurigram sadar
Nageshwari
Phulbari
Rajarhat
Raomari
Ulipur
Kustia (6)
Bheramara
Daulatpur
Khoksa
Kumarkhali
Kushtia Sadar
Mirpur upazila
Lalmonirhat (5)
Aditmari
Hatibandha
Kaliganj sadar
Lalmonirhat Sadar
Patgram
Laxmipur (7)
Banchanagar (Laxmipur
Chandraganj
Kamalnagar
Laxmipur Sadar
Raipur
Ramganj
Ramgati
Madaripur (5)
Dasar
Kalkini
Madaripur sadar
Rajoir
Shibchar
Magura (4)
Magura sadar
Mohammadpur upazila
Shalikha
Sreepur upazila
Manikganj (8)
Boro Sorundi (Manikganj)
Daulatpur upazila
Ghior
Harirampur
Manikganj Sadar
Saturia
Shivalaya
Singair
Meherpur (3)
Gangi
Meherpur sadar
Mujibnagar
Moulvibazar (13)
Barlekha
Barlekha (Moulvibazar)
Dakshinbhag
Juri
Kamalganj
Kamolganj
Kulaura
Moulvibazar Sadar
Rajnagar
Rajnagor
Robirbazar (Moulvibazar)
Sherpur Moulvibazar
Sreemangal
Munshiganj (6)
Gazaria
Louhajang
Munshiganj Sadar
Sirajdikhan
Sreenagar
Tongibari
Mymensingh (15)
Bhaluka
Dhobaura
Fulbaria
Gafargaon
Gouripur
Haluaghat
Ishwarganj
Muktagacha
Mymensingh Sadar
Nandail
Pagla
Phulpur
Shambhuganj
Tarakanda
Trishal
Naogaon (10)
Atrai
Badolgachi
Dhamoirhat
Manda
Mohadevpur
Naogaon sadar
Niamatpur
Patnitala
Porsha
Raninagar Sapahar
Narail (4)
Kalia
Lohagara
Naragati
Narail Sadar
**Naraynganj ** (8)
Araihajar
Bandar
Fatullah
Kanchpur Highway
Narayanganj Sadar
Rupganj
Shiddhirganj
Sonargaon
Narshindi (10)
Belabo
Ghorashal
Madhobdi
Monohardi
Narsingdi Sadar
Null
Null
Palash
Raipura
Shibpur
Natore (9)
Bagatipara
Baraigram
Gopalpur Pourosova
Gurudaspur
Lalpur
Naldanga
Natore
Natore Sadar
Singra
Netrokona (10)
Atpara
Barhatta
Durgapur
Kalmakanda
Kendua
Khaliajuri
Madan
Mohonganj
Netrokona Sadar
Parbadhala
Nilphamari (6)
Dimla
Domar
jaldhaka
kishoreganj
Nilphamari Sadar
Saidpur
Noakhali (9)
Begamganj
Chatkhil
Companyganj
Hatiya
Kabir Hat
Noakhali Sadar
Senbagh
Sonaimuri
Subarnachar
Pabna (10)
Ataikula (Pabna)
Atgharia
Bera
Bhangura
Chatmohar
Foridpur (Pabna)
Ishwardi
Pabna Sadar
Santhia
Sujanagar
Panchgarh (5)
Atwari
Boda
Debiganj
Panchgarh sadar Thana
Tetulia
Patuakhali (8)
Bauphal
Dashmina
Dumki
Galachipa
Kalapara
Mirzaganj
Patuakhali Sadar
Rangabali
Pirojpur (8)
Bhandaria
Indurkani
Kawkhali
Mathbaria
Nazirpur
Nesarabad
Pirojpur Sadar
Swarupkati
Rajbari (6)
(Goalanda Mor) Rajbari Office
Baliakandi
Goalananda
Kalukhali
pangsha
Rajbari Sadar
Rajshahi (16)
Airport (Rajshahi)
Bagha
Bagmara
Belpukur
Boalia
Chandrima Thana
Charghat
Damkura
Durgapur
Godagari
Kashiadanga
Katakhali
Kornohar
Matihar Thana
Mohanpur
Paba
Rangamati (10)
Bagaichhari
Barkal
Belaichhari
Juraichhari
Kaptai
Kawkhali upazila
Langadu
Naniarchar
Rajasthali
Rangamati Sadar
Rangpur (9)
Badarganj
Gangachara
Kaunia
Mitapukur
Pirgacha
Pirganj
Rangpur Sadar
Shatibari
Taraganj
Shariatpur (7)
Bhedarganj
Damudya
Gosairhat
Naria
Sakhipur upazila
Shariatpur sadar
Zajira
Shatkhira (8)
Assasuni
Debhata
Kalaroa
Kaliganj
Patkelghata
Shatkhira sadar
Shyamnagar
Tala
Sherpur (5)
Jhenaigati
Nakla
Nalitabari
Sherpur sadar
Sreebardi
Sirajganj (9)
Belkuchi
Chowhali
Kamarkhanda
Kazipur
Raiganj
Shahjadpur
Sirajganj Sadar
Tarash
Ullapara
**Sunamganj ** (14)
Bishwamvapur
chhatak
Derai
Dharmapasha
Dowarabazar
Jagannathpur
Jamalganj
Moddonagar
Norshingpur
Raniganj
Shantiganj
Sullah
Sunamganj Sadar
Tahirpur
Sylhet (23)
Ambarkhana
Balaganj
Beanibazar
Bishanath
Companyganj upazila
Dhakadakshin (Golapganj)
Fenchuganj
gobindaganj
Golapganj
Gowainghat
Jalalabad
Jalalabad
Jalalabad cantonment
Jintiapur
Kanaighat
Modina Market
Moglabazar
Osmaninagar
Shahporan
South Surma
Sylhet sadar
Uposhahar
Zakiganj
Tangail (13)
Basail
Bhuapur
Delduar
Dhanbari
Ghatail
Gopalpur
Kalihati
Madhupur
Mirzapur
Nagarpur
Sakhipur
Sokhipur
Tangail Sadar
Thakurgaon (5)
Baliadangi
Haripur
Pirganj upazila
Ranisankail
Thakurgaon Sadar
"""

class Command(BaseCommand):
    help = 'Import and link districts and thanas from custom raw data.'

    def handle(self, *args, **options):
        self.stdout.write("Starting district & thana import...")

        lines = RAW_DATA.strip().split('\n')
        current_district = None
        
        districts_created = 0
        thanas_created = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Identify if it is a district heading line (ends with parenthesis or contains numbers in parenthesis)
            # E.g. "Bagerhat (10)", "**Chittagong ** (38)"
            if '(' in line and line.endswith(')'):
                district_name = line.split('(')[0].replace('*', '').strip()
                current_district, created = District.objects.get_or_create(name=district_name)
                if created:
                    districts_created += 1
                self.stdout.write(f"District: {district_name} ({'Created' if created else 'Exists'})")
            else:
                if current_district:
                    thana_name = line.replace('*', '').strip()
                    
                    # Ignore placeholder null values
                    if thana_name.lower() in ('null', ''):
                        continue
                        
                    # Calculate shipping cost: 70 for Dhaka City, 100 for Dhaka Sub-Urban, 120 for others
                    shipping_cost = Decimal('120.00')
                    if current_district.name == "Dhaka City":
                        shipping_cost = Decimal('70.00')
                    elif current_district.name == "Dhaka Sub-Urban":
                        shipping_cost = Decimal('100.00')
                    
                    thana, created = Thana.objects.get_or_create(
                        district=current_district,
                        name=thana_name,
                        defaults={'shipping_cost': shipping_cost}
                    )
                    
                    # Update shipping cost if it exists but is different
                    if not created and thana.shipping_cost != shipping_cost:
                        thana.shipping_cost = shipping_cost
                        thana.save()
                        
                    if created:
                        thanas_created += 1
                        
        self.stdout.write(self.style.SUCCESS(
            f"Successfully processed. Districts created: {districts_created}, Thanas created: {thanas_created}."
        ))
