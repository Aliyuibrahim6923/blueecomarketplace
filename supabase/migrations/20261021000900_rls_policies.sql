-- =============================================================================
-- BlueMarket Nigeria — 0900 Row Level Security policies and privileges
--
-- Principle: start from zero privileges for anon/authenticated, then grant the
-- minimum each role needs. RLS decides which rows; grants decide which commands
-- (and, for notifications, which columns). State machines are RPC-only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reset privileges (Supabase grants broad defaults on the public schema).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Re-grant the helper functions RLS policies call.
grant execute on function
  private.is_client_role(), private.try_uuid(text), private.slugify(text),
  private.has_role(public.app_role), private.is_admin(), private.is_agency_analyst(), private.is_active_user(),
  private.is_business_member(uuid), private.is_business_manager(uuid), private.business_is_active(uuid),
  private.business_can_sell(uuid), private.business_can_offer_logistics(uuid),
  private.is_enquiry_party(uuid), private.is_order_participant(uuid), private.is_dispute_participant(uuid),
  private.setting_int(text, integer), private.setting_bool(text, boolean),
  private.enforce_rate_limit(text, integer, integer)
to anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Command grants (rows are filtered by the policies below)
-- ---------------------------------------------------------------------------
grant select on public.regions, public.categories, public.products, public.product_images,
  public.businesses, public.logistics_services, public.reviews, public.platform_settings
to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, email_notifications, sms_notifications, marketing_consent) on public.profiles to authenticated;
grant select, insert on public.role_assignments to authenticated;
grant insert on public.businesses to authenticated;
grant update (name, slug, description, business_category, is_supplier, is_logistics_provider, is_buyer_organisation,
  state_code, city, service_states, contact_public, logo_path, deleted_at) on public.businesses to authenticated;
grant select, insert, update on public.business_private_details to authenticated;
grant select on public.business_memberships to authenticated;
grant select, insert on public.business_verification_requests to authenticated;
grant insert, update, delete on public.categories to authenticated;              -- admin-only via policy
grant insert, update on public.products to authenticated;
grant insert, delete on public.product_images to authenticated;
grant select, insert, delete on public.saved_products to authenticated;
grant select, insert on public.enquiries to authenticated;
grant select, insert on public.enquiry_messages to authenticated;
grant select on public.quotations to authenticated;
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
grant select on public.payment_transactions to authenticated;
grant select on public.payment_webhook_events to authenticated;                   -- admin-only via policy
grant insert, update on public.logistics_services to authenticated;
grant select, insert on public.logistics_bookings to authenticated;
grant insert, update on public.reviews to authenticated;
grant select on public.disputes to authenticated;
grant select, insert on public.dispute_messages to authenticated;
grant select, insert on public.dispute_attachments to authenticated;
grant select, insert on public.content_reports to authenticated;
grant insert on public.support_requests to anon, authenticated;
grant select on public.support_requests to authenticated;                         -- admin-only via policy
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant select on public.notification_outbox to authenticated;                      -- admin-only via policy
grant select on public.audit_logs to authenticated;                               -- admin-only via policy

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- regions ---------------------------------------------------------------------
create policy regions_read on public.regions for select to anon, authenticated using (true);

-- profiles --------------------------------------------------------------------
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- role_assignments --------------------------------------------------------------
create policy roles_read_own on public.role_assignments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy roles_self_service_insert on public.role_assignments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role in ('buyer', 'supplier', 'logistics_provider')
    and granted_by is null and revoked_at is null and revoked_by is null
  );

-- businesses --------------------------------------------------------------------
create policy businesses_public_read on public.businesses for select to anon, authenticated
  using (
    (deleted_at is null and status = 'active')
    or (select private.is_business_member(id))
    or (select private.is_admin())
  );
create policy businesses_insert_owner on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_active_user()));
create policy businesses_update_manager on public.businesses for update to authenticated
  using ((select private.is_business_manager(id)))
  with check ((select private.is_business_manager(id)));

create policy bpd_read on public.business_private_details for select to authenticated
  using ((select private.is_business_member(business_id)) or (select private.is_admin()));
create policy bpd_insert on public.business_private_details for insert to authenticated
  with check ((select private.is_business_manager(business_id)));
create policy bpd_update on public.business_private_details for update to authenticated
  using ((select private.is_business_manager(business_id)))
  with check ((select private.is_business_manager(business_id)));

create policy memberships_read on public.business_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_business_member(business_id))
    or (select private.is_admin())
  );

create policy bvr_read on public.business_verification_requests for select to authenticated
  using ((select private.is_business_member(business_id)) or (select private.is_admin()));
create policy bvr_insert on public.business_verification_requests for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and (select private.is_business_manager(business_id))
    and (document_path is null or document_path like business_id::text || '/%')
  );

-- categories ----------------------------------------------------------------------
create policy categories_read on public.categories for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy categories_admin_insert on public.categories for insert to authenticated
  with check ((select private.is_admin()));
create policy categories_admin_update on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_admin_delete on public.categories for delete to authenticated
  using ((select private.is_admin()));

-- products ------------------------------------------------------------------------
create policy products_read on public.products for select to anon, authenticated
  using (
    (
      status = 'published' and deleted_at is null
      and (expires_at is null or expires_at > now())
      and (select private.business_is_active(business_id))
    )
    or (select private.is_business_member(business_id))
    or (select private.is_admin())
  );
create policy products_insert_member on public.products for insert to authenticated
  with check (
    (select private.is_business_member(business_id))
    and created_by = (select auth.uid())
  );
create policy products_update_member on public.products for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

-- product images: visible when the product is visible (products RLS applies).
create policy product_images_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy product_images_insert on public.product_images for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_id
      and private.is_business_member(p.business_id)
      and storage_path like p.business_id::text || '/%'
  ));
create policy product_images_delete on public.product_images for delete to authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and private.is_business_member(p.business_id)
  ));

-- saved products ------------------------------------------------------------------
create policy saved_products_own on public.saved_products for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- enquiries -----------------------------------------------------------------------
create policy enquiries_read on public.enquiries for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or (select private.is_business_member(supplier_business_id))
    or (select private.is_admin())
  );
create policy enquiries_insert_buyer on public.enquiries for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and (select private.is_active_user())
    and (select private.business_can_sell(supplier_business_id))
    and not (select private.is_business_member(supplier_business_id))
    and (buyer_business_id is null or (select private.is_business_member(buyer_business_id)))
    and (product_id is null or exists (
      select 1 from public.products p
      where p.id = product_id and p.business_id = supplier_business_id and p.status = 'published'))
  );

create policy enquiry_messages_read on public.enquiry_messages for select to authenticated
  using ((select private.is_enquiry_party(enquiry_id)) or (select private.is_admin()));
create policy enquiry_messages_insert on public.enquiry_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.is_enquiry_party(enquiry_id))
    and exists (select 1 from public.enquiries e where e.id = enquiry_id and e.status <> 'closed')
  );

-- quotations ----------------------------------------------------------------------
create policy quotations_read on public.quotations for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or (select private.is_business_member(supplier_business_id))
    or (select private.is_admin())
  );

-- orders --------------------------------------------------------------------------
create policy orders_read on public.orders for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or (select private.is_business_member(seller_business_id))
    or (select private.is_admin())
  );
create policy order_items_read on public.order_items for select to authenticated
  using ((select private.is_order_participant(order_id)) or (select private.is_admin()));
create policy order_status_history_read on public.order_status_history for select to authenticated
  using ((select private.is_order_participant(order_id)) or (select private.is_admin()));
create policy payment_transactions_read on public.payment_transactions for select to authenticated
  using ((select private.is_order_participant(order_id)) or (select private.is_admin()));
create policy payment_webhook_events_admin on public.payment_webhook_events for select to authenticated
  using ((select private.is_admin()));

-- logistics -----------------------------------------------------------------------
create policy logistics_services_read on public.logistics_services for select to anon, authenticated
  using (
    (status = 'published' and deleted_at is null and (select private.business_is_active(business_id)))
    or (select private.is_business_member(business_id))
    or (select private.is_admin())
  );
create policy logistics_services_insert on public.logistics_services for insert to authenticated
  with check ((select private.is_business_member(business_id)) and created_by = (select auth.uid()));
create policy logistics_services_update on public.logistics_services for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

create policy logistics_bookings_read on public.logistics_bookings for select to authenticated
  using (
    requester_id = (select auth.uid())
    or (select private.is_business_member(provider_business_id))
    or (select private.is_admin())
  );
create policy logistics_bookings_insert on public.logistics_bookings for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and (select private.is_active_user())
    and exists (
      select 1 from public.logistics_services s
      where s.id = service_id and s.status = 'published' and s.deleted_at is null)
    and not (select private.is_business_member(provider_business_id))
    and (requester_business_id is null or (select private.is_business_member(requester_business_id)))
    and (order_id is null or (select private.is_order_participant(order_id)))
  );

-- reviews -------------------------------------------------------------------------
create policy reviews_read on public.reviews for select to anon, authenticated
  using (
    status = 'published'
    or author_id = (select auth.uid())
    or (select private.is_business_member(business_id))
    or (select private.is_admin())
  );
create policy reviews_insert_buyer on public.reviews for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.buyer_id = (select auth.uid())
        and o.status = 'completed'
        and o.seller_business_id = business_id)
  );
create policy reviews_update_author on public.reviews for update to authenticated
  using (author_id = (select auth.uid()) and created_at > now() - interval '14 days')
  with check (author_id = (select auth.uid()));

-- disputes ------------------------------------------------------------------------
create policy disputes_read on public.disputes for select to authenticated
  using ((select private.is_dispute_participant(id)) or (select private.is_admin()));

create policy dispute_messages_read on public.dispute_messages for select to authenticated
  using (
    (not is_internal and (select private.is_dispute_participant(dispute_id)))
    or (select private.is_admin())
  );
create policy dispute_messages_insert on public.dispute_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (not is_internal and (select private.is_dispute_participant(dispute_id))
        and exists (select 1 from public.disputes d where d.id = dispute_id and d.status not in ('resolved', 'rejected')))
      or (select private.is_admin())
    )
  );

create policy dispute_attachments_read on public.dispute_attachments for select to authenticated
  using ((select private.is_dispute_participant(dispute_id)) or (select private.is_admin()));
create policy dispute_attachments_insert on public.dispute_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and ((select private.is_dispute_participant(dispute_id)) or (select private.is_admin()))
    and storage_path like dispute_id::text || '/%'
  );

-- reports & support ----------------------------------------------------------------
create policy content_reports_read on public.content_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy content_reports_insert on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy support_requests_insert on public.support_requests for insert to anon, authenticated
  with check (true);
create policy support_requests_admin_read on public.support_requests for select to authenticated
  using ((select private.is_admin()));

-- notifications ----------------------------------------------------------------------
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_outbox_admin on public.notification_outbox for select to authenticated
  using ((select private.is_admin()));

-- audit & settings ----------------------------------------------------------------------
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using ((select private.is_admin()));
create policy platform_settings_read on public.platform_settings for select to anon, authenticated
  using (is_public or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- RPC privileges
-- ---------------------------------------------------------------------------
grant execute on function public.order_transition_allowed(public.order_status, public.order_status, text) to anon, authenticated;
grant execute on function public.booking_transition_allowed(public.booking_status, public.booking_status, text) to anon, authenticated;
grant execute on function public.record_product_view(uuid) to anon, authenticated;
grant execute on function public.get_business_contact(uuid) to anon, authenticated;

grant execute on function
  public.create_order(uuid, jsonb, text, text, text, text, uuid),
  public.accept_order(uuid, bigint, date, text, text),
  public.transition_order(uuid, public.order_status, text),
  public.create_quotation(uuid, text, text, bigint, numeric, bigint, date, text, uuid),
  public.respond_quotation(uuid, public.quotation_status),
  public.accept_quotation(uuid, text, text, text, text),
  public.create_payment_transaction(uuid, public.payment_provider, text),
  public.sandbox_confirm_payment(uuid),
  public.confirm_offline_payment(uuid, text, text),
  public.close_enquiry(uuid),
  public.complete_onboarding(text, text, public.app_role[], boolean, boolean),
  public.export_my_data(),
  public.request_account_deletion(text),
  public.add_business_member(uuid, text, public.membership_role),
  public.remove_business_member(uuid, uuid),
  public.get_order_parties(uuid),
  public.refresh_listing(uuid, numeric),
  public.transition_booking(uuid, public.booking_status, bigint, date, text, text),
  public.open_dispute(uuid, public.dispute_category, text),
  public.admin_update_dispute(uuid, public.dispute_status, text),
  public.resolve_dispute(uuid, public.dispute_outcome, text, boolean),
  public.review_verification_request(uuid, public.verification_request_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.admin_set_business_status(uuid, public.account_status, text),
  public.grant_privileged_role(uuid, public.app_role),
  public.revoke_role(uuid, public.app_role),
  public.moderate_listing(uuid, text, text),
  public.moderate_logistics_service(uuid, text, text),
  public.moderate_review(uuid, public.review_status, text),
  public.handle_content_report(uuid, public.report_status, text),
  public.close_support_request(uuid),
  public.update_platform_setting(text, jsonb)
to authenticated;

-- Payment result recording is for the server (service role) only.
grant execute on function
  public.record_webhook_event(public.payment_provider, text, text, text, boolean, text),
  public.mark_webhook_event_processed(public.payment_provider, text, text),
  public.record_payment_result(text, public.payment_status, bigint, text, text, bigint, text)
to service_role;
