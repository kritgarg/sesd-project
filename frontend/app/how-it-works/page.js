"use client";

import styles from "../page.module.css";
import Link from "next/link";

export default function HowItWorks() {
  return (
    <div className={styles.pageWrapper} style={{ justifyContent: 'flex-start', paddingTop: '6rem' }}>
      
      <Link href="/" style={{ position: 'absolute', top: '2rem', left: '2rem', color: '#FFE600', textDecoration: 'none', fontSize: '1.5rem', fontWeight: 'bold' }}>
        ← BACK TO SWIFTSHARE
      </Link>

      <section className={styles.howItWorks} style={{ marginTop: '2rem' }}>
        <h2 className={styles.howTitle}>How It Works</h2>
        <div className={styles.cardsGrid}>
          <div className={styles.howCard}>
            <div className={styles.cardStep}>1</div>
            <h3 className={styles.cardHeader}>Select & Drop</h3>
            <p className={styles.cardDesc}>Simply drop your files into the main brutalist yellow block. We instantly pack them up instantly on your local device—nothing goes to our servers.</p>
          </div>
          <div className={styles.howCard}>
            <div className={styles.cardStep}>2</div>
            <h3 className={styles.cardHeader}>Share the Link</h3>
            <p className={styles.cardDesc}>We generate a secure WebRTC P2P link. Send it to anyone, anywhere in the world and wait for them to click.</p>
          </div>
          <div className={styles.howCard}>
            <div className={styles.cardStep}>3</div>
            <h3 className={styles.cardHeader}>Direct Speed</h3>
            <p className={styles.cardDesc}>Your files flow straight to them via a direct, encrypted pipeline. No intermediate servers means blazing fast and ultra-private transfers.</p>
          </div>
        </div>

        <div style={{ marginTop: '4rem', padding: '1rem', border: '2px solid #FFE600', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: '#FFE600', fontSize: '1rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Disclaimer: Sender and receiver must be on the same WiFi network for faster transfer. Please do not close the tab until files are fully shared.
          </p>
        </div>
      </section>

    </div>
  );
}
