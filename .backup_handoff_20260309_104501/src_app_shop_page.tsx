import React from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";
import AddProduct from "../components/add-product";


import { productData } from "../data/data";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";

interface productData{
    id: number;
    image: string;
    name: string;
}
 
export default function Page() {

  return (
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <div>
                        <h5 className="text-lg font-semibold">Shop Items</h5>

                        <ul className="tracking-[0.5px] inline-flex items-center mt-2">
                            <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Techwind</Link></li>
                            <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                            <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Shop</li>
                        </ul>
                    </div>

                    <AddProduct/>
                </div>

                <div className="grid xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 mt-6 gap-6">
                    {productData.map((item:productData,index:number) => {
                        return(
                            <div className="group" key={index}>
                                <div className="relative overflow-hidden shadow-sm dark:shadow-gray-700 group-hover:shadow-lg group-hover:dark:shadow-gray-700 rounded-md duration-500">
                                    <Image src={item.image} width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL={item.image} style={{width:'100%', height:'auto'}} alt=""/>

                                    <div className="absolute -bottom-20 group-hover:bottom-3 start-3 end-3 duration-500">
                                        <Link href="/shop-cart" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-slate-900 border-slate-900 text-white w-full rounded-md">Add to Cart</Link>
                                    </div>

                                    <ul className="list-none absolute top-2.5 end-4 opacity-0 group-hover:opacity-100 duration-500">
                                        <li><Link href="#" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-full bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white"><i className="mdi mdi-heart"></i></Link></li>
                                        <li className="mt-1"><Link href={`/shop-item-detail/${item.id}`} className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-full bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white"><i className="mdi mdi-eye-outline"></i></Link></li>
                                        <li className="mt-1"><Link href="#" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-full bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white"><i className="mdi mdi-bookmark-outline"></i></Link></li>
                                    </ul>

                                    <ul className="list-none absolute top-2.5 start-4">
                                        <li><Link href="#" className="bg-orange-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded h-5">New</Link></li>
                                    </ul>
                                </div>

                                <div className="mt-4">
                                    <Link href={`/shop-item-detail/${item.id}`} className="hover:text-primary text-lg font-semibold">{item.name}</Link>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-green-600">$16.00 <del className="text-red-600">$21.00</del></p>
                                        <ul className="font-medium text-amber-400 list-none">
                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="flex justify-end mt-6">
                    <nav aria-label="Page navigation example">
                        <ul className="inline-flex items-center -space-x-px">
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 bg-white dark:bg-slate-900 rounded-s-lg hover:text-white border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">
                                    <MdKeyboardArrowLeft className="text-[20px] rtl:rotate-180 rtl:-mt-1"/>
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">1</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">2</Link>
                            </li>
                            <li>
                                <Link href="#" aria-current="page" className="z-10 size-10 inline-flex justify-center items-center text-white bg-primary border border-primary">3</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">4</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">5</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 bg-white dark:bg-slate-900 rounded-e-lg hover:text-white border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">
                                    <MdKeyboardArrowRight className="text-[20px] rtl:rotate-180 rtl:-mt-1"/>
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
            
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
   
  )
}
