// GHL Integration for BioSource Nutra Meal Planner
// Add this to your biosource-complete.html

// CONFIGURATION
const GHL_CONFIG = {
    locationId: 'YOUR_GHL_LOCATION_ID',  // Get from GHL Settings
    apiKey: 'YOUR_GHL_API_KEY',          // Create in GHL API Settings
    baseUrl: 'https://services.leadconnectorhq.com'
};

// CREATE OR UPDATE CONTACT IN GHL
async function saveToGHL(customerData) {
    try {
        console.log('Saving customer to GHL...', customerData);
        
        // Step 1: Create/Update Contact
        const contactPayload = {
            firstName: customerData.name.split(' ')[0],
            lastName: customerData.name.split(' ').slice(1).join(' ') || customerData.name,
            email: customerData.email,
            phone: customerData.phone || '',
            locationId: GHL_CONFIG.locationId,
            tags: ['meal-plan-customer', `plan-${customerData.duration}-days`],
            customFields: [
                { key: 'meal_plan_duration', value: customerData.duration },
                { key: 'meal_plan_calories', value: customerData.calories },
                { key: 'meal_plan_bmi', value: customerData.bmi.toString() },
                { key: 'meal_plan_bmr', value: customerData.bmr.toString() },
                { key: 'meal_plan_goal', value: customerData.goal },
                { key: 'meal_plan_activity', value: customerData.activity },
                { key: 'meal_plan_restrictions', value: customerData.restrictions.join(',') },
                { key: 'meal_plan_proteins', value: customerData.proteins.join(',') },
                { key: 'meal_plan_cooking_level', value: customerData.cookingLevel },
                { key: 'meal_plan_data', value: JSON.stringify(customerData.mealPlan) },
                { key: 'meal_plan_status', value: 'active' },
                { key: 'meal_plan_created_date', value: new Date().toISOString() }
            ]
        };

        // Upsert contact (create or update)
        const contactResponse = await fetch(`${GHL_CONFIG.baseUrl}/contacts/upsert`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GHL_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28'
            },
            body: JSON.stringify(contactPayload)
        });

        if (!contactResponse.ok) {
            throw new Error(`GHL Contact API Error: ${contactResponse.status}`);
        }

        const contactData = await contactResponse.json();
        console.log('✅ Contact saved to GHL:', contactData);
        
        // Store contact ID for later use
        customerData.ghlContactId = contactData.contact.id;
        
        return contactData.contact;
        
    } catch (error) {
        console.error('❌ Error saving to GHL:', error);
        // Don't block the user experience - log and continue
        return null;
    }
}

// SEND EMAIL VIA KLAVIYO (Your existing email service)
async function sendToKlaviyo(customerData) {
    try {
        console.log('Sending to Klaviyo...', customerData);
        
        const klaviyoPayload = {
            token: 'YOUR_KLAVIYO_PUBLIC_API_KEY',
            event: 'Meal Plan Generated',
            customer_properties: {
                '$email': customerData.email,
                '$first_name': customerData.name.split(' ')[0],
                'meal_plan_duration': customerData.duration,
                'meal_plan_calories': customerData.calories,
                'bmi': customerData.bmi,
                'bmr': customerData.bmr
            },
            properties: {
                'plan_duration': customerData.duration,
                'calorie_target': customerData.calories,
                'goal': customerData.goal,
                'pdf_url': customerData.pdfUrl || '',
                'plan_view_url': `https://app.biosourcenutra.com/plan/${customerData.ghlContactId}`
            }
        };

        const response = await fetch('https://a.klaviyo.com/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(klaviyoPayload)
        });

        if (response.ok) {
            console.log('✅ Klaviyo event tracked');
        }
        
    } catch (error) {
        console.error('❌ Klaviyo error:', error);
    }
}

// UPDATE MEAL PLAN (When coach makes changes)
async function updateMealPlanInGHL(contactId, updatedMealPlan) {
    try {
        const response = await fetch(`${GHL_CONFIG.baseUrl}/contacts/${contactId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GHL_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28'
            },
            body: JSON.stringify({
                customFields: [
                    { 
                        key: 'meal_plan_data', 
                        value: JSON.stringify(updatedMealPlan) 
                    }
                ]
            })
        });

        if (response.ok) {
            console.log('✅ Meal plan updated in GHL');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Error updating meal plan:', error);
        return false;
    }
}

// LINK SHOPIFY ORDER
async function linkShopifyOrder(contactId, orderId, orderUrl) {
    try {
        const response = await fetch(`${GHL_CONFIG.baseUrl}/contacts/${contactId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GHL_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28'
            },
            body: JSON.stringify({
                customFields: [
                    { key: 'shopify_order_id', value: orderId },
                    { key: 'shopify_order_url', value: orderUrl }
                ]
            })
        });

        if (response.ok) {
            console.log('✅ Shopify order linked');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Error linking Shopify order:', error);
        return false;
    }
}

// MODIFIED generateMealPlan function to include GHL save
async function generateMealPlan() {
    customerData.createdAt = new Date().toISOString();
    const cal = customerData.calories;
    const dur = parseInt(customerData.duration);
    
    // ... existing meal plan generation code ...
    
    customerData.mealPlan = plan;
    
    // 🔥 NEW: Save to GHL
    const ghlContact = await saveToGHL(customerData);
    
    if (ghlContact) {
        // 🔥 NEW: Send to Klaviyo for email delivery
        await sendToKlaviyo(customerData);
        
        // Show success message
        displayResults();
        
        alert('🎉 Success!\n\n✅ Meal plan generated\n✅ Saved to your coach dashboard\n✅ Email will arrive in 2-3 minutes');
    } else {
        // Still show results even if GHL save failed
        displayResults();
        alert('⚠️ Meal plan generated, but there was an issue saving to the coach dashboard. Your plan is still available below!');
    }
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveToGHL,
        updateMealPlanInGHL,
        linkShopifyOrder,
        sendToKlaviyo
    };
}
