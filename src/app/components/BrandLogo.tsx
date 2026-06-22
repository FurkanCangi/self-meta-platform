import Image from "next/image";
import styles from "./BrandLogo.module.css";

type BrandLogoProps = {
  variant?: "header" | "footer" | "mark" | "panel";
};

export default function BrandLogo({ variant = "header" }: BrandLogoProps) {
  if (variant === "header") {
    return (
      <div className={`${styles.logo} ${styles.header}`} aria-label="DNA Intelligence Dynamic Neuro-Regulation Approach">
        <Image
          src="/images/brand/dna-logo-header-readable.png"
          alt="DNA Intelligence Dynamic Neuro-Regulation Approach"
          width={1383}
          height={552}
          priority
          unoptimized
          className={styles.image}
          sizes="(max-width: 1320px) 330px, 400px"
        />
      </div>
    );
  }

  return (
    <div className={`${styles.logo} ${styles[variant]}`} aria-label="DNA Intelligence Dynamic Neuro-Regulation Approach">
      <Image
        src={
          variant === "mark"
            ? "/images/brand/dna-logo-intelligence-symbol-transparent.png"
            : variant === "panel"
              ? "/images/brand/dna-logo-intelligence-symbol-transparent.png"
              : "/images/brand/dna-logo-header-readable.png"
        }
        alt="DNA Intelligence Dynamic Neuro-Regulation Approach"
        width={variant === "mark" || variant === "panel" ? 585 : 1383}
        height={variant === "mark" || variant === "panel" ? 657 : 552}
        className={styles.image}
        sizes={variant === "footer" ? "340px" : variant === "panel" ? "132px" : "92px"}
      />
    </div>
  );
}
