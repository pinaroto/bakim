// ============================================================
//  Pınar Oto Bakım Servisi — Veritabanı Modülü (Firebase)
//  Veriler Firebase Firestore'da saklanır.
//  Tüm cihazlar aynı veriyi görür (Windows, Android, iOS).
// ============================================================

// ── Firebase Yapılandırması ─────────────────────────────────
// Bu bilgileri Firebase Console'dan kopyalayın:
// https://console.firebase.google.com → Proje → Proje Ayarları → Uygulamalar
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyABSIyOa9jD1J0HrOpmMpTjOE30iapGZcs",
  authDomain:        "pinarotobakim-d721e.firebaseapp.com",
  projectId:         "pinarotobakim-d721e",
  storageBucket:     "pinarotobakim-d721e.firebasestorage.app",
  messagingSenderId: "68099987385",
  appId:             "1:68099987385:web:c43226b07244621b634868",
  measurementId:     "G-9TM6Z0X91K"
};

const KOLEKSIYON = "bakimKayitlari";

let _db = null;

function db_baslat() {
  if (_db) return _db;
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  _db = firebase.firestore();
  return _db;
}

// ── Tüm kayıtları getir ─────────────────────────────────────
async function db_tumKayitlari() {
  const db = db_baslat();
  const snap = await db.collection(KOLEKSIYON).orderBy("olusturmaZamani", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Plakaya göre kayıtları getir ────────────────────────────
async function db_plakaAra(plaka) {
  const db = db_baslat();
  const temiz = plaka.trim().toUpperCase().replace(/\s+/g, '');
  const snap = await db.collection(KOLEKSIYON)
    .where("plaka", "==", temiz)
    .get();
  
  // Sıralamayı Firebase yerine telefonun kendi içinde yapıyoruz (Index istemez)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.olusturmaZamani || '').localeCompare(a.olusturmaZamani || ''));
}

// ── Genel arama (plaka veya isim) ───────────────────────────
async function db_ara(metin) {
  const q = metin.trim().toUpperCase();
  const liste = await db_tumKayitlari();
  return liste.filter(k =>
    k.plaka.toUpperCase().includes(q) ||
    (k.aracSahibi || '').toUpperCase().includes(q)
  );
}

// ── Kayıt ekle ──────────────────────────────────────────────
async function db_kayitEkle(kayit) {
  const db = db_baslat();
  kayit.olusturmaZamani = new Date().toISOString();
  const ref = await db.collection(KOLEKSIYON).add(kayit);
  kayit.id = ref.id;
  return kayit;
}

// ── Kayıt güncelle ──────────────────────────────────────────
async function db_kayitGuncelle(id, kayit) {
  const db = db_baslat();
  // Mevcut kaydı oku, olusturmaZamani'yi koru
  const mevcut = await db.collection(KOLEKSIYON).doc(id).get();
  if (mevcut.exists && mevcut.data().olusturmaZamani) {
    kayit.olusturmaZamani = mevcut.data().olusturmaZamani;
  } else {
    // Alan yoksa şimdiki zamanı koy (eski bozuk kayıtlar için)
    kayit.olusturmaZamani = new Date().toISOString();
  }
  kayit.guncellemZamani = new Date().toISOString();
  await db.collection(KOLEKSIYON).doc(id).set(kayit);
  return kayit;
}

// ── Canlı dinle (gerçek zamanlı güncelleme) ─────────────────
// Firestore'daki değişiklikleri anlık olarak dinler.
// callback(liste) şeklinde çağrılır, unsubscribe fonksiyonu döner.
function db_canliDinle(callback) {
  const db = db_baslat();
  const unsubscribe = db.collection(KOLEKSIYON)
    .orderBy('olusturmaZamani', 'desc')
    .onSnapshot(snap => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(liste);
    }, err => {
      console.error('Canlı dinleme hatası:', err);
    });
  return unsubscribe;
}

// ── Kayıt sil ───────────────────────────────────────────────
async function db_kayitSil(id) {
  const db = db_baslat();
  await db.collection(KOLEKSIYON).doc(id).delete();
}

// ── JSON olarak dışa aktar ───────────────────────────────────
async function db_disaAktar() {
  const liste = await db_tumKayitlari();
  const veri = JSON.stringify(liste, null, 2);
  const blob = new Blob([veri], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'pinar_oto_yedek_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON dosyasından içe aktar ──────────────────────────────
async function db_iceAktar(jsonMetin) {
  try {
    const yeni = JSON.parse(jsonMetin);
    if (!Array.isArray(yeni)) throw new Error('Geçersiz format');
    const db = db_baslat();
    const batch = db.batch();
    let eklenen = 0;
    for (const k of yeni) {
      const { id, ...veri } = k;
      const ref = db.collection(KOLEKSIYON).doc();
      batch.set(ref, veri);
      eklenen++;
    }
    await batch.commit();
    return { basari: true, eklenen };
  } catch (e) {
    return { basari: false, hata: e.message };
  }
}
