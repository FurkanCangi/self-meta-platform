import React from "react";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import UserProfileTab from "../components/user-profile-tab";
import Wrapper from "../components/wrapper";

export default function Page(){
    return(
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="grid grid-cols-1">
                    <div className="profile-banner relative text-transparent rounded-md shadow-sm dark:shadow-gray-700 overflow-hidden">
                        <input id="pro-banner" name="profile-banner" type="file" className="hidden"/>
                        <div className="relative shrink-0">
                            <Image src='/images/blog/bg.jpg' width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL="/images/blog/bg.jpg" style={{width:"100%", height:"auto"}} className="!h-80 w-full object-cover" id="profile-banner" alt=""/>
                            <div className="absolute inset-0 bg-slate-900/70"></div>
                            <label className="absolute inset-0 cursor-pointer" htmlFor="pro-banner"></label>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-12 grid-cols-1">
                   <UserProfileTab/>
                   <div className="xl:col-span-9 lg:col-span-8 md:col-span-8 mt-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div className="relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                    <h5 className="text-lg font-semibold">Account Notifications :</h5>
                                </div>
    
                                <div className="p-6">
                                    <div className="flex justify-between pb-4">
                                        <h6 className="mb-0 font-medium">When someone mentions me</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="noti1"/>
                                            <label className="form-check-label" htmlFor="noti1"></label>
                                        </div>
                                    </div>
                                    <div className="flex justify-between py-4 border-t border-gray-100 dark:border-gray-700">
                                        <h6 className="mb-0 font-medium">When someone follows me</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" defaultChecked id="noti2"/>
                                            <label className="form-check-label" htmlFor="noti2"></label>
                                        </div>
                                    </div>
                                    <div className="flex justify-between py-4 border-t border-gray-100 dark:border-gray-700">
                                        <h6 className="mb-0 font-medium">When shares my activity</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="noti3"/>
                                            <label className="form-check-label" htmlFor="noti3"></label>
                                        </div>
                                    </div>
                                    <div className="flex justify-between py-4 border-t border-gray-100 dark:border-gray-700">
                                        <h6 className="mb-0 font-medium">When someone messages me</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="noti4"/>
                                            <label className="form-check-label" htmlFor="noti4"></label>
                                        </div>
                                    </div>
                                </div>
                            </div>
    
                            <div className="relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                    <h5 className="text-lg font-semibold">Marketing Notifications :</h5>
                                </div>
    
                                <div className="p-6">
                                    <div className="flex justify-between pb-4">
                                        <h6 className="mb-0 font-medium">There is a sale or promotion</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="noti5"/>
                                            <label className="form-check-label" htmlFor="noti5"></label>
                                        </div>
                                    </div>
                                    <div className="flex justify-between py-4 border-t border-gray-100 dark:border-gray-700">
                                        <h6 className="mb-0 font-medium">Company news</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="noti6"/>
                                            <label className="form-check-label" htmlFor="noti6"></label>
                                        </div>
                                    </div>
                                    <div className="flex justify-between py-4 border-t border-gray-100 dark:border-gray-700">
                                        <h6 className="mb-0 font-medium">Weekly jobs</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" defaultChecked id="noti7"/>
                                            <label className="form-check-label" htmlFor="noti7"></label>
                                        </div>
                                    </div>
                                    <div className="flex justify-between py-4 border-t border-gray-100 dark:border-gray-700">
                                        <h6 className="mb-0 font-medium">Unsubscribe News</h6>
                                        <div className="">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" defaultChecked id="noti8"/>
                                            <label className="form-check-label" htmlFor="noti8"></label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
    )
}