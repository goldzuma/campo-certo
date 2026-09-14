-- Envio publico de documentos: apenas escrita, sem leitura
CREATE POLICY "publico envia documentos" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "admin le documentos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos' AND public.eh_admin(auth.uid()));
CREATE POLICY "admin remove documentos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documentos' AND public.eh_admin(auth.uid()));

CREATE POLICY "admin gerencia logos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'logos' AND public.eh_admin(auth.uid()))
  WITH CHECK (bucket_id = 'logos' AND public.eh_admin(auth.uid()));
