"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function NotFound() {
  return (
    <div className={styles.pageWrapper}>
      <main className={styles.mainContent}>
        <div className={styles.yellowCardContainer} style={{ filter: 'none' }}>
          
          <div className={styles.yellowTop} style={{ borderRadius: '40px' }}>
            <h1 className={styles.cardText} style={{ fontSize: '8rem', color: '#121210' }}>
              404
            </h1>
          </div>

          <div className={styles.scriptText} style={{ transform: 'translate(-50%, -100%) rotate(-5deg)', fontSize: '4rem' }}>
            Not Found
          </div>

          <div style={{ marginTop: '3rem' }}>
            <Link 
              href="/"
              className={styles.startBtn}
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              GO HOME
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
