/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
// ===== INSTRUCTIONS FOR REAL FIREBASE IMPLEMENTATION =====
// 1. Install the Firebase SDK if you haven't already:
//    npm install firebase
//
// 2. Uncomment the following imports:
// import { initializeApp } from 'firebase/app';
// import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
//
// 3. Fill in your Firebase configuration object:
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_AUTH_DOMAIN",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };
//
// 4. Initialize Firebase and Firestore:
// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);
//
// 5. Replace the mock `getCustomerContextByPhoneNumber` function with the real one provided below.
//    Make sure your Firestore database has a collection named 'customers'
//    and that documents in it have a 'phoneNumber' string field and a 'context' array field.
*/

// Mock customer database
const mockCustomerDatabase = [
  {
    id: 'cust1',
    phoneNumber: '+15551234567',
    context: [
      "Customer previously reported issues with order #ABC-123 not arriving on time.",
      "Has a history of purchasing premium widgets.",
      "Last interaction summary: Was satisfied with the 50% discount offered for the late delivery."
    ]
  },
  {
    id: 'cust2',
    phoneNumber: '+15559876543',
    context: [
      "New customer, first interaction.",
      "Interested in bulk purchasing options.",
    ]
  },
];


/**
 * MOCK FUNCTION: Simulates fetching a customer's context from Firestore by phone number.
 * @param phoneNumber The customer's phone number to search for.
 * @returns A promise that resolves to an array of context strings.
 */
const getCustomerContextByPhoneNumber = async (phoneNumber: string): Promise<string[]> => {
  console.log('Searching mock customer database for phone number:', phoneNumber);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const customer = mockCustomerDatabase.find(c => c.phoneNumber === phoneNumber);

  if (customer) {
    console.log('Found mock customer context:', customer.context);
    return customer.context;
  }

  console.log('No context found for this phone number.');
  return [];
};


/*
// ===== REAL FIREBASE IMPLEMENTATION (Replace the mock function with this) =====
const getCustomerContextByPhoneNumber = async (phoneNumber: string): Promise<string[]> => {
  if (!db || !phoneNumber) {
    return [];
  }
  try {
    const customersRef = collection(db, 'customers');
    // Query for a document where the 'phoneNumber' field matches.
    const q = query(
      customersRef,
      where('phoneNumber', '==', phoneNumber),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`No customer found with phone number: ${phoneNumber}`);
      return [];
    }

    const customerDoc = querySnapshot.docs[0];
    // Assuming each customer document has a 'context' field which is an array of strings.
    const context = customerDoc.data().context || [];
    console.log(`Retrieved context for ${phoneNumber}:`, context);
    return context;

  } catch (error) {
    console.error("Error searching Firestore for customer:", error);
    return [];
  }
};
*/

export const firestoreService = {
  getCustomerContextByPhoneNumber,
};
