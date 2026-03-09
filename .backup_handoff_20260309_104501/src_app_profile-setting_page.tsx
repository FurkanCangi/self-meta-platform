import React from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import UserProfileTab from "../components/user-profile-tab";
import Wrapper from "../components/wrapper";
 
import * as Icon from 'react-feather'

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
                            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <h5 className="text-lg font-semibold mb-4">Personal Detail :</h5>
                                <form>
                                    <div className="grid lg:grid-cols-2 grid-cols-1 gap-5">
                                        <div>
                                            <label className="form-label font-medium">First Name : <span className="text-red-600">*</span></label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.User className="size-4 absolute top-3 start-4"/>
                                                <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="First Name:" id="firstname" name="name"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label font-medium">Last Name : <span className="text-red-600">*</span></label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.UserCheck className="size-4 absolute top-3 start-4"/>
                                                <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Last Name:" id="lastname" name="name"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label font-medium">Your Email : <span className="text-red-600">*</span></label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.Mail className="size-4 absolute top-3 start-4"/>
                                                <input type="email" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Email" name="email"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label font-medium">Occupation : </label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.Bookmark className="size-4 absolute top-3 start-4"/>
                                                <input name="name" id="occupation" type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Occupation :"/>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1">
                                        <div className="mt-5">
                                            <label className="form-label font-medium">Description : </label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.MessageCircle className="size-4 absolute top-3 start-4"/>
                                                <textarea name="comments" id="comments" className="form-input ps-11 w-full py-2 px-3 h-28 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Message :"></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    <input type="submit" id="submit" name="send" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md mt-5" value="Save Changes"/>
                                </form>
                            </div>

                            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <div className="grid lg:grid-cols-2 grid-cols-1 gap-6">
                                    <div>
                                        <h5 className="text-lg font-semibold mb-4">Contact Info :</h5>
    
                                        <form>
                                            <div className="grid grid-cols-1 gap-5">
                                                <div>
                                                    <label className="form-label font-medium">Phone No. :</label>
                                                    <div className="form-icon relative mt-2">
                                                        <Icon.Phone className="size-4 absolute top-3 start-4"/>
                                                        <input name="number" id="number" type="number" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Phone :"/>
                                                    </div>
                                                </div>
    
                                                <div>
                                                    <label className="form-label font-medium">Website :</label>
                                                    <div className="form-icon relative mt-2">
                                                        <Icon.Globe className="size-4 absolute top-3 start-4"/>
                                                        <input name="url" id="url" type="url" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Url :"/>
                                                    </div>
                                                </div>
                                            </div>
    
                                            <button className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md mt-5">Add</button>
                                        </form>
                                    </div>
                                    
                                    <div> 
                                        <h5 className="text-lg font-semibold mb-4">Change password :</h5>
                                        <form>
                                            <div className="grid grid-cols-1 gap-5">
                                                <div>
                                                    <label className="form-label font-medium">Old password :</label>
                                                    <div className="form-icon relative mt-2">
                                                        <Icon.Key className="size-4 absolute top-3 start-4"/>
                                                        <input type="password" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Old password"/>
                                                    </div>
                                                </div>
        
                                                <div>
                                                    <label className="form-label font-medium">New password :</label>
                                                    <div className="form-icon relative mt-2">
                                                        <Icon.Key  className="size-4 absolute top-3 start-4"/>
                                                        <input type="password" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="New password"/>
                                                    </div>
                                                </div>
        
                                                <div>
                                                    <label className="form-label font-medium">Re-type New password :</label>
                                                    <div className="form-icon relative mt-2">
                                                        <Icon.Key  className="size-4 absolute top-3 start-4"/>
                                                        <input type="password" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Re-type New password"/>
                                                    </div>
                                                </div>
                                            </div>
        
                                            <button className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md mt-5">Save password</button>
                                        </form>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <h5 className="text-lg font-semibold mb-4 text-red-600">Delete Account :</h5>

                                <p className="text-slate-400 mb-4">Do you want to delete the account? Please press below Delete button</p>

                                <Link href="#" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white rounded-md">Delete</Link>
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