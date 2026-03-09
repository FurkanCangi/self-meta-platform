"use client"
import React,{useState}  from "react";
import Link from "next/link";
import Image from "next/image";

import { portfolioData,portfolioImage } from "../data/data";

import {Lightbox} from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { AiOutlineCamera } from "react-icons/ai";

interface PortfolioData{
    id: number;
    image: string;
    title1: string;
    title2: string;
}


export default function Portfolio(){

    let [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
    let [isOpen, setisOpen] = useState<boolean>(false);

    let handleImageClick = (index:number) => {
        setCurrentImageIndex(index);
        setisOpen(true);
    };
    const slides = portfolioImage.map((image) => ({ src: image }));

    return(
        <div className="grid lg:grid-cols-3 md:grid-cols-2 mt-6 gap-6">
        {portfolioData.map((item:PortfolioData,index:number) => {
            return(
                <div className="group relative block overflow-hidden rounded-md duration-500" key={index}>
                    <Image src={item.image} width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL="{item.image}" style={{width:'100%', height:'auto'}} className="group-hover:origin-center group-hover:scale-110 group-hover:rotate-3 duration-500" alt=""/>
                    <div className="absolute inset-2 group-hover:bg-white/90 dark:group-hover:bg-slate-900/90 duration-500 z-0 rounded-md"></div>

                    <div className="content duration-500">
                        <div className="icon absolute z-10 opacity-0 group-hover:opacity-100 top-6 end-6 duration-500">
                            <Link href="#" onClick={() => handleImageClick(item.id)} className="size-9 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-full lightbox"><AiOutlineCamera/></Link>
                        </div>

                        <div className="absolute z-10 opacity-0 group-hover:opacity-100 bottom-6 start-6 duration-500">
                            <Link href="/portfolio-detail-three" className="h6 text-lg font-medium hover:text-primary duration-500 ease-in-out">{item.title1}</Link>
                            <p className="text-slate-400 mb-0">{item.title2}</p>
                        </div>
                    </div>
                </div>
            )
        })}
         <Lightbox
                open={isOpen}
                close={() => setisOpen(false)}
                slides={slides}
                index={currentImageIndex} // Show the clicked image first
            />
    </div>  
    )
}