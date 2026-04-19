"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import styles from "./page.module.css";

// SVG Icons
const ArrowDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>
);

export default function Home() {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preloaderLoaded, setPreloaderLoaded] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Trigger preloader split effect shortly after mount
    const timer = setTimeout(() => {
      setPreloaderLoaded(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setStagedFiles((prev) => [...prev, ...files]);
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setStagedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  const removeFile = (idx) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStart = async () => {
    if (stagedFiles.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/room/create`
      );
      sessionStorage.setItem(
        "swiftshare_staged",
        JSON.stringify(stagedFiles.map((f) => f.name))
      );
      window.__swiftshare_files = stagedFiles;
      
      // Delay push slightly so loading animation can be seen
      setTimeout(() => {
        router.push(`/room/${res.data.code}`);
      }, 500);
    } catch (e) {
      console.error("Failed to create room", e);
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`${styles.preloader} ${preloaderLoaded ? styles.loaded : ""}`}>
        <div className={styles.preloaderTop}></div>
        <div className={styles.preloaderBottom}></div>
      </div>

      <div className={styles.pageWrapper}>
        
        <div className={styles.arrowIcon}>
          <ArrowDown />
        </div>

        <main className={styles.mainContent}>
          <div className={`${styles.yellowCardContainer} ${dragActive ? styles.dragActive : ""}`}
               onDragEnter={handleDrag}
               onDragLeave={handleDrag}
               onDragOver={handleDrag}
               onDrop={handleDrop}
          >
            
            <div className={styles.yellowTop}>
              <h1 className={styles.cardText}>
                SWIFT<br/>SHARE
              </h1>
            </div>

            <div className={styles.scriptText} style={{ transform: 'translate(-50%, -60%) rotate(-5deg)' }}>
              Drop Your Files
            </div>

            <div className={styles.yellowBottom}>
              <h1 className={styles.cardText}>FILES</h1>

              <div className={styles.actionArea}>
                {loading ? (
                   <div className={styles.loadingSpinner}></div>
                ) : stagedFiles.length === 0 ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      style={{display: 'none'}}
                      onChange={handleFileSelect}
                    />
                    <button 
                      className={styles.browseBtn} 
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.fileList}>
                      {stagedFiles.map((file, idx) => (
                        <div key={idx} className={styles.fileItem}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{file.name}</span>
                          <button onClick={() => removeFile(idx)} className={styles.removeBtn}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                      <button className={styles.startBtn} onClick={handleStart}>
                        START
                      </button>
                      <button 
                        className={styles.browseBtn} 
                        onClick={() => fileInputRef.current?.click()}
                      >
                        +
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{display: 'none'}}
                      onChange={handleFileSelect}
                    />
                  </>
                )}
              </div>
            </div>

          </div>
        </main>

        <nav className={styles.navBar}>
          <div 
            className={styles.navLines} 
            onClick={() => setIsSidebarOpen(true)}
            style={{cursor: 'pointer'}}
          >
            <div></div>
            <div></div>
          </div>
          <div>SWIFTSHARE</div>
          <div className={styles.navBars}>
            <div style={{height: '6px'}}></div>
            <div style={{height: '12px'}}></div>
            <div style={{height: '16px'}}></div>
            <div style={{height: '10px'}}></div>
            <div style={{height: '4px'}}></div>
          </div>
        </nav>
        
        <div 
          className={`${styles.sidebarOverlay} ${isSidebarOpen ? styles.open : ""}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}>
          <button className={styles.closeSidebarBtn} onClick={() => setIsSidebarOpen(false)}>✕</button>
          <div className={styles.sidebarTitle}>MENU</div>
          <div className={styles.sidebarMenu}>
            <Link href="/how-it-works" className={styles.sidebarLink} onClick={() => setIsSidebarOpen(false)}>How it works</Link>
            <a href="https://github.com/kritgarg" target="_blank" rel="noreferrer" className={styles.sidebarLink}>Developer</a>
          </div>
          <div className={styles.socialLinks}>
            <a href="https://github.com/kritgarg" target="_blank" rel="noreferrer" className={styles.socialIcon}>GitHub</a>
            <a href="https://linkedin.com/in/kritgarg" target="_blank" rel="noreferrer" className={styles.socialIcon}>LinkedIn</a>
          </div>
        </div>
      </div>
    </>
  );
}

