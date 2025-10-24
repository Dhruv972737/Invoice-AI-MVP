#!/usr/bin/env python3
"""
Test if Gemini API key is working
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv('backend/fastapi/.env')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

print("=" * 50)
print("GEMINI API KEY TEST")
print("=" * 50)

# Check if key exists
if not GEMINI_API_KEY or GEMINI_API_KEY == 'your-gemini-api-key-here':
    print("❌ GEMINI_API_KEY not set or is placeholder!")
    print(f"   Current value: {GEMINI_API_KEY[:20]}...")
    exit(1)

print(f"✅ API Key found: {GEMINI_API_KEY[:10]}...")

# Try to use it
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')

    print("\n🔄 Testing API call...")
    response = model.generate_content("Say 'API works!'")

    print(f"✅ API Response: {response.text}")
    print("\n✅ SUCCESS! Gemini API is working correctly!")

except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    print("\n💡 Possible issues:")
    print("   1. Invalid API key")
    print("   2. API key doesn't have permissions")
    print("   3. Quota exceeded")
    print("   4. Network issues")
    exit(1)

print("=" * 50)
