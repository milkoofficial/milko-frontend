'use client';

import React from 'react';
import { DotLottiePlayer } from '@dotlottie/react-player';
import styles from '@/app/get-trial-pack/page.module.css';

export default function TrialLottie() {
  const lottieUrl = "/animations/trial.lottie";

  return (
    <div className={styles.lottieContainer}>
      <div className={styles.lottieRow}>
        <DotLottiePlayer
          autoplay
          loop
          src={lottieUrl}
          speed={0.5}
          style={{ width: '600px', height: '600px', marginTop: '-120px', marginRight: '-100px' }}
        />
        <DotLottiePlayer
          autoplay
          loop
          src={lottieUrl}
          speed={0.5}
          style={{ width: '600px', height: '600px', marginTop: '-120px', marginLeft: '-100px' }}
        />
      </div>
    </div>
  );
}
