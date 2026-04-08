from google import genai

# 1. Inisialisasi Client dengan API Key Anda yang baru dibuat
client = genai.Client(api_key="iniapikey")

# 2. Kirim pesan ke model Gemini 2.5 Flash (Gratis & Cepat)
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='Halo, tolong berikan satu hadis pendek tentang menuntut ilmu beserta terjemahannya.'
)

# 3. Tampilkan hasil respons dari AI
print(response.text)
