'use client';

import React, { useState } from 'react';
import { uploadBytes, ref, getDownloadURL } from 'firebase/storage';
import { doc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Upload, Building2, Loader2, Phone, Banknote, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';

export function VendorOnboardingForm() {
  const { auth, firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    vendorCategory: 'General',
    contactPhone: '',
    momoNumber: '',
    momoName: '',
    momoBankCode: 'MTN',
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !auth.currentUser || !formData.businessName || !formData.momoNumber || !formData.momoName || !formData.momoBankCode || !formData.contactPhone) {
        toast({
            variant: 'destructive',
            title: 'Missing Information',
            description: 'Please fill out all fields and select a file to upload.',
        });
        return;
    }

    setLoading(true);
    try {
      // 1. Upload ID to Firebase Storage
      const storageRef = ref(storage, `verification_docs/${auth.currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const docUrl = await getDownloadURL(storageRef);

      // 2. Update the User/Vendor document in Firestore
      const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
      updateDocumentNonBlocking(userDocRef, {
        name: formData.businessName, // Update name to business name
        vendorCategory: formData.vendorCategory,
        contactPhone: formData.contactPhone,
        momoNumber: formData.momoNumber,
        momoName: formData.momoName,
        momoBankCode: formData.momoBankCode,
        verificationDocUrl: docUrl,
        onboardingStatus: 'pending_review',
        updatedAt: new Date().toISOString()
      });

      toast({
          title: "Documents Submitted",
          description: "Your information has been sent for Liaison review!",
      });

    } catch (error: any) {
      console.error(error);
      toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: error.message || 'Could not upload verification document.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center items-center">
            <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
                <Building2 size={32} />
            </div>
            <CardTitle>Vendor Verification</CardTitle>
            <CardDescription>Submit your credentials for GAM Hub Liaison approval</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleUpload} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="flex items-center gap-2"><Building2 size={16} /> Business/Company Name</Label>
                  <Input 
                      id="businessName"
                      type="text" required
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="momoName" className="flex items-center gap-2"><UserIcon size={16} /> MoMo Account Name</Label>
                  <Input 
                      id="momoName"
                      type="text" required
                      placeholder="e.g., Jane Doe"
                      value={formData.momoName}
                      onChange={(e) => setFormData({...formData, momoName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="contactPhone" className="flex items-center gap-2"><Phone size={16} /> Business Contact (Calls)</Label>
                        <Input 
                            id="contactPhone"
                            type="tel" required
                            placeholder="e.g., 0241234567"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="momoNumber" className="flex items-center gap-2"><Banknote size={16} /> MoMo Payout Number</Label>
                        <Input 
                            id="momoNumber"
                            type="tel" required
                            placeholder="e.g., 0551234567"
                            value={formData.momoNumber}
                            onChange={(e) => setFormData({...formData, momoNumber: e.target.value})}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="momoBankCode" className="flex items-center gap-2"><Banknote size={16} /> MoMo Provider</Label>
                        <Select
                            onValueChange={(value) => setFormData({...formData, momoBankCode: value})}
                            defaultValue={formData.momoBankCode}
                        >
                            <SelectTrigger id="momoBankCode">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                                <SelectItem value="VOD">Telecel Cash</SelectItem>
                                <SelectItem value="ATL">AT Money</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category">Business Category</Label>
                        <Select
                            onValueChange={(value) => setFormData({...formData, vendorCategory: value})}
                            defaultValue={formData.vendorCategory}
                        >
                            <SelectTrigger id="category">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="General">General Merchant</SelectItem>
                                <SelectItem value="Bank">Bank / Financial Institution</SelectItem>
                                <SelectItem value="Food">Food & Restaurant</SelectItem>
                                <SelectItem value="Stationery">Books & Stationery</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="p-6 border-2 border-dashed border-muted-foreground/30 rounded-2xl text-center">
                    <input 
                        type="file" id="doc" hidden 
                        accept="image/*,.pdf"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <Label htmlFor="doc" className="cursor-pointer space-y-2">
                        <Upload className="mx-auto text-muted-foreground mb-2" />
                        <p className="font-semibold text-primary">
                        {file ? "File selected" : "Click to upload"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                        {file ? file.name : "Ghana Card or Business Registration"}
                        </p>
                    </Label>
                </div>

                <Button 
                disabled={loading}
                className="w-full"
                type="submit"
                >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck size={20}/>}
                {loading ? "Uploading..." : "Submit for Review"}
                </Button>
            </form>
      </CardContent>
    </Card>
  );
}
