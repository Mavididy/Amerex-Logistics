document.addEventListener('DOMContentLoaded', function() {
        // Form elements
        const quoteForm = document.getElementById('quoteForm');
        const resetBtn = document.getElementById('resetQuote');
        const liveQuoteDisplay = document.getElementById('liveQuoteDisplay');
        const quoteResult = document.getElementById('quoteResult');
        
        // Quick calculator elements
        const calcWeight = document.getElementById('calcWeight');
        const calcService = document.getElementById('calcService');
        const calculateBtn = document.getElementById('calculateBtn');
        const quickQuoteResult = document.getElementById('quickQuoteResult');
        
        // Mobile quick calculator elements
        const mobileCalcWeight = document.getElementById('mobileCalcWeight');
        const mobileCalcService = document.getElementById('mobileCalcService');
        const mobileCalculateBtn = document.getElementById('mobileCalculateBtn');
        const mobileQuickQuoteResult = document.getElementById('mobileQuickQuoteResult');
        
        // Quote result action buttons
        const proceedBtn = document.getElementById('proceedBtn');
        const saveQuoteBtn = document.getElementById('saveQuoteBtn');
        const emailQuoteBtn = document.getElementById('emailQuoteBtn');
        
        // Input elements for live quote calculation
        const weightInput = document.getElementById('q_weight');
        const serviceSelect = document.getElementById('q_service');
        const valueInput = document.getElementById('q_value');
        const signatureCheckbox = document.getElementById('opt_signature');
        const insuranceCheckbox = document.getElementById('opt_insurance');
        const saturdayCheckbox = document.getElementById('opt_saturday');
        const packagingCheckbox = document.getElementById('opt_packaging');
        
        // Base pricing rates (in a real app, this would come from your backend)
        const basePricing = {
          express: {
            baseRate: 15.99,
            perPound: 2.50
          },
          standard: {
            baseRate: 9.99,
            perPound: 1.20
          },
          freight: {
            baseRate: 5.99,
            perPound: 0.85
          },
          international: {
            baseRate: 25.99,
            perPound: 3.75
          }
        };
        
        // Addons pricing
        const addonPricing = {
          signature: 3.00,
          insuranceRate: 0.02, // 2% of value
          saturday: 15.00,
          packaging: 8.00
        };
        
        // Format currency
        function formatCurrency(amount) {
          return '$' + parseFloat(amount).toFixed(2);
        }
        
        // Generate a quote ID
        function generateQuoteId() {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          
          return `Q-${year}${month}${day}-${random}`;
        }
        
        // Calculate shipping cost
        function calculateShippingCost(weight, service, options = {}) {
          if (!weight || !service || !basePricing[service]) {
            return null;
          }
          
          const pricing = basePricing[service];
          let baseShipping = pricing.baseRate + (weight * pricing.perPound);
          
          // Calculate addons
          let signatureCost = options.signature ? addonPricing.signature : 0;
          let insuranceCost = options.insurance && options.value ? (options.value * addonPricing.insuranceRate) : 0;
          let saturdayCost = options.saturday ? addonPricing.saturday : 0;
          let packagingCost = options.packaging ? addonPricing.packaging : 0;
          
          // Total
          let total = baseShipping + signatureCost + insuranceCost + saturdayCost + packagingCost;
          
          return {
            baseShipping: baseShipping,
            signatureCost: signatureCost,
            insuranceCost: insuranceCost,
            saturdayCost: saturdayCost,
            packagingCost: packagingCost,
            total: total
          };
        }
        
        // Update live quote display
        function updateLiveQuote() {
          const weight = parseFloat(weightInput.value);
          const service = serviceSelect.value;
          const value = parseFloat(valueInput.value) || 0;
          
          const options = {
            signature: signatureCheckbox.checked,
            insurance: insuranceCheckbox.checked,
            value: value,
            saturday: saturdayCheckbox.checked,
            packaging: packagingCheckbox.checked
          };
          
          if (weight && service) {
            const quote = calculateShippingCost(weight, service, options);
            
            if (quote) {
              document.getElementById('baseShippingCost').textContent = formatCurrency(quote.baseShipping);
              
              // Update addons
              document.getElementById('signatureCostRow').style.display = options.signature ? 'flex' : 'none';
              document.getElementById('signatureCost').textContent = formatCurrency(quote.signatureCost);
              
              document.getElementById('insuranceCostRow').style.display = options.insurance ? 'flex' : 'none';
              document.getElementById('insuranceCost').textContent = formatCurrency(quote.insuranceCost);
              
              document.getElementById('saturdayCostRow').style.display = options.saturday ? 'flex' : 'none';
              document.getElementById('saturdayCost').textContent = formatCurrency(quote.saturdayCost);
              
              document.getElementById('packagingCostRow').style.display = options.packaging ? 'flex' : 'none';
              document.getElementById('packagingCost').textContent = formatCurrency(quote.packagingCost);
              
              // Update total
              document.getElementById('totalCost').textContent = formatCurrency(quote.total);
              
              // Show live quote display if not already visible
              if (!liveQuoteDisplay.classList.contains('active')) {
                liveQuoteDisplay.classList.add('active');
              }
            }
          }
        }
        
        // Validate form input
        function validateForm() {
          let isValid = true;
          
          // Required fields
          const requiredFields = [
            { id: 'q_name', error: 'nameError', message: 'Please enter your full name' },
            { id: 'q_email', error: 'emailError', message: 'Please enter a valid email address' },
            { id: 'q_origin', error: 'originError', message: 'Please enter origin location' },
            { id: 'q_destination', error: 'destinationError', message: 'Please enter destination location' },
            { id: 'q_weight', error: 'weightError', message: 'Please enter package weight' },
            { id: 'q_service', error: 'serviceError', message: 'Please select a service type' }
          ];
          
          // Check each required field
          requiredFields.forEach(field => {
            const input = document.getElementById(field.id);
            const errorElement = document.getElementById(field.error);
            const formGroup = input.closest('.form-group');
            
            let fieldValid = true;
            
            if (!input.value.trim()) {
              fieldValid = false;
            } else if (field.id === 'q_email') {
              // Email validation
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              fieldValid = emailRegex.test(input.value.trim());
              if (!fieldValid) {
                errorElement.textContent = 'Please enter a valid email address';
              }
            } else if (field.id === 'q_weight') {
              // Weight validation
              const weight = parseFloat(input.value);
              if (isNaN(weight) || weight <= 0) {
                fieldValid = false;
                errorElement.textContent = 'Weight must be greater than zero';
              }
            }
            
            if (!fieldValid) {
              formGroup.classList.add('error');
              isValid = false;
            } else {
              formGroup.classList.remove('error');
            }
          });
          
          // Check dimensions format if provided
          const dimensions = document.getElementById('q_dimensions').value.trim();
          if (dimensions && !dimensions.toLowerCase().match(/^\d+\s*x\s*\d+\s*x\s*\d+$/)) {
            document.getElementById('q_dimensions').closest('.form-group').classList.add('error');
            document.getElementById('dimensionsError').textContent = 'Please use format: L x W x H';
            isValid = false;
          }
          
          return isValid;
        }
        
        // Submit quote form
        quoteForm.addEventListener('submit', async function(e) {
          e.preventDefault();
          
          if (!validateForm()) {
            // Scroll to the first error
            const firstError = document.querySelector('.form-group.error');
            if (firstError) {
              firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
          }
          
          // Show loader
          document.getElementById('pageLoader').classList.remove('hidden');
          
          try {
            // Get form data
            const formData = new FormData(quoteForm);
            const quoteData = {
              name: formData.get('name'),
              email: formData.get('email'),
              phone: formData.get('phone'),
              company: formData.get('company'),
              origin: formData.get('origin'),
              destination: formData.get('destination'),
              weight: parseFloat(formData.get('weight')),
              service: formData.get('service'),
              dimensions: formData.get('dimensions'),
              value: parseFloat(formData.get('value')) || 0,
              signature: formData.has('signature'),
              insurance: formData.has('insurance'),
              saturday: formData.has('saturday'),
              packaging: formData.has('packaging'),
              instructions: formData.get('instructions'),
              quote_id: generateQuoteId(),
              created_at: new Date().toISOString()
            };
            
            // Calculate final quote
            const options = {
              signature: quoteData.signature,
              insurance: quoteData.insurance,
              value: quoteData.value,
              saturday: quoteData.saturday,
              packaging: quoteData.packaging
            };
            
            const quote = calculateShippingCost(quoteData.weight, quoteData.service, options);
            quoteData.total_amount = quote.total;
            
            // In a real app, you'd save this quote to your Supabase database
            // For now, we'll simulate saving by adding a delay
            /*
            const { data, error } = await supabase
              .from('quotes')
              .insert([quoteData]);
              
            if (error) throw error;
            */
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update quote result display
            document.getElementById('quoteId').textContent = quoteData.quote_id;
            document.getElementById('quotePrice').textContent = formatCurrency(quote.total);
            document.getElementById('quoteOrigin').textContent = quoteData.origin;
            document.getElementById('quoteDestination').textContent = quoteData.destination;
            document.getElementById('quoteService').textContent = quoteData.service.charAt(0).toUpperCase() + quoteData.service.slice(1);
            document.getElementById('quoteWeight').textContent = quoteData.weight + ' lbs';
            
            // Show selected addons
            document.getElementById('signatureAddon').style.display = quoteData.signature ? 'block' : 'none';
            document.getElementById('insuranceAddon').style.display = quoteData.insurance ? 'block' : 'none';
            document.getElementById('saturdayAddon').style.display = quoteData.saturday ? 'block' : 'none';
            document.getElementById('packagingAddon').style.display = quoteData.packaging ? 'block' : 'none';
            
            // Hide the form and show the result
            quoteForm.style.display = 'none';
            quoteResult.classList.add('active');
            
            // Scroll to quote result
            quoteResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
          } catch (error) {
            console.error('Error generating quote:', error);
            
            // Show error dialog
            const uiDialog = document.getElementById('uiDialog');
            const iconElement = document.getElementById('uiDialogIcon');
            const titleElement = document.getElementById('uiDialogTitle');
            const messageElement = document.getElementById('uiDialogMessage');
            const okButton = document.getElementById('uiDialogOk');
            
            iconElement.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>';
            titleElement.textContent = 'Error';
            messageElement.textContent = 'We encountered an error generating your quote. Please try again.';
            
            okButton.onclick = function() {
              uiDialog.classList.add('hidden');
            };
            
            uiDialog.classList.remove('hidden');
            
          } finally {
            // Hide loader
            document.getElementById('pageLoader').classList.add('hidden');
          }
        });
        
        // Reset form
        resetBtn.addEventListener('click', function() {
          quoteForm.reset();
          liveQuoteDisplay.classList.remove('active');
          
          // Clear all error states
          document.querySelectorAll('.form-group.error').forEach(group => {
            group.classList.remove('error');
          });
        });
        
        // Quick calculator (desktop)
        calculateBtn.addEventListener('click', function() {
          const weight = parseFloat(calcWeight.value);
          const service = calcService.value;
          
          if (!weight || !service) {
            quickQuoteResult.innerHTML = 'Please enter weight and select service';
            quickQuoteResult.style.color = '#ef4444';
            return;
          }
          
          const quote = calculateShippingCost(weight, service);
          
          if (quote) {
            quickQuoteResult.innerHTML = `
              <div style="font-size: 1.2rem; font-weight: 700; color: #00a6a6; margin-bottom: 5px;">
                ${formatCurrency(quote.total)}
              </div>
              <div style="font-size: 0.9rem;">
                For ${weight} lbs, ${service.charAt(0).toUpperCase() + service.slice(1)} service
              </div>
              <button type="button" class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="location.href='#quoteForm'">
                Full Quote
              </button>
            `;
            quickQuoteResult.style.color = 'inherit';
          } else {
            quickQuoteResult.innerHTML = 'Unable to calculate. Please try again.';
            quickQuoteResult.style.color = '#ef4444';
          }
        });
        
        // Quick calculator (mobile)
        mobileCalculateBtn.addEventListener('click', function() {
          const weight = parseFloat(mobileCalcWeight.value);
          const service = mobileCalcService.value;
          
          if (!weight || !service) {
            mobileQuickQuoteResult.innerHTML = 'Please enter weight and select service';
            mobileQuickQuoteResult.style.color = '#ef4444';
            return;
          }
          
          const quote = calculateShippingCost(weight, service);
          
          if (quote) {
            mobileQuickQuoteResult.innerHTML = `
              <div style="font-size: 1.2rem; font-weight: 700; color: #00a6a6; margin-bottom: 5px;">
                ${formatCurrency(quote.total)}
              </div>
              <div style="font-size: 0.9rem;">
                For ${weight} lbs, ${service.charAt(0).toUpperCase() + service.slice(1)} service
              </div>
              <button type="button" class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="location.href='#quoteForm'">
                Full Quote
              </button>
            `;
            mobileQuickQuoteResult.style.color = 'inherit';
          } else {
            mobileQuickQuoteResult.innerHTML = 'Unable to calculate. Please try again.';
            mobileQuickQuoteResult.style.color = '#ef4444';
          }
        });
        
        // Live quote calculation on input change
        [weightInput, serviceSelect, valueInput, signatureCheckbox, insuranceCheckbox, saturdayCheckbox, packagingCheckbox].forEach(element => {
          element.addEventListener('input', updateLiveQuote);
        });
        
        // Quote result action buttons
        proceedBtn.addEventListener('click', function() {
          // In a real app, this would take the user to the shipping page
          // with the quote details pre-filled
          window.location.href = 'create-shipment.html';
        });
        
        saveQuoteBtn.addEventListener('click', function() {
          // In a real app, this would save the quote to the user's account
          // For now, show a dialog
          const uiDialog = document.getElementById('uiDialog');
          const iconElement = document.getElementById('uiDialogIcon');
          const titleElement = document.getElementById('uiDialogTitle');
          const messageElement = document.getElementById('uiDialogMessage');
          const okButton = document.getElementById('uiDialogOk');
          
          iconElement.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>';
          titleElement.textContent = 'Quote Saved';
          messageElement.textContent = 'Your quote has been saved successfully. You can access it from your account dashboard.';
          
          okButton.onclick = function() {
            uiDialog.classList.add('hidden');
          };
          
          uiDialog.classList.remove('hidden');
        });
        
        emailQuoteBtn.addEventListener('click', function() {
          // In a real app, this would email the quote to the user
          // For now, show a dialog
          const uiDialog = document.getElementById('uiDialog');
          const iconElement = document.getElementById('uiDialogIcon');
          const titleElement = document.getElementById('uiDialogTitle');
          const messageElement = document.getElementById('uiDialogMessage');
          const okButton = document.getElementById('uiDialogOk');
          
          iconElement.innerHTML = '<i class="fas fa-envelope" style="color: #00a6a6;"></i>';
          titleElement.textContent = 'Quote Emailed';
          messageElement.textContent = 'Your quote has been sent to your email address. Please check your inbox.';
          
          okButton.onclick = function() {
            uiDialog.classList.add('hidden');
          };
          
          uiDialog.classList.remove('hidden');
        });
        
        // Auto-fill service in main form from quick calculator
        calcService.addEventListener('change', function() {
          if (this.value) {
            serviceSelect.value = this.value;
            updateLiveQuote();
          }
        });
        
        // Auto-fill weight in main form from quick calculator
        calcWeight.addEventListener('input', function() {
          const weight = parseFloat(this.value);
          if (!isNaN(weight) && weight > 0) {
            weightInput.value = weight;
            updateLiveQuote();
          }
        });
        
        // Same for mobile calculator
        mobileCalcService.addEventListener('change', function() {
          if (this.value) {
            serviceSelect.value = this.value;
            updateLiveQuote();
          }
        });
        
        mobileCalcWeight.addEventListener('input', function() {
          const weight = parseFloat(this.value);
          if (!isNaN(weight) && weight > 0) {
            weightInput.value = weight;
            updateLiveQuote();
          }
        });
      });