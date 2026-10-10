-- Subscription plan master configuration only. Prices are configuration values (INR), not code.
-- No firms or billing records are created or changed here.
INSERT INTO sos.business_masters(group_code,value_code,label,position,enabled,metadata) VALUES
('subscription_plans','monthly','Starter',0,true,'{"monthlyPrice":2999,"billingPeriod":"month"}'::jsonb),
('subscription_plans','annual','Growth',1,true,'{"monthlyPrice":9999,"billingPeriod":"month"}'::jsonb),
('subscription_plans','enterprise','Consortium',2,true,'{"monthlyPrice":24999,"billingPeriod":"year"}'::jsonb)
ON CONFLICT DO NOTHING;
