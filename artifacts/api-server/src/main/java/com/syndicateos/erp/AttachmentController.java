package com.syndicateos.erp;

import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.ApiProblem;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Private, single-instance EC2 file adapter. Files survive web/JAR replacements and require project authorization. */
@RestController
@RequestMapping("/api/erp/{projectId}/attachments")
public class AttachmentController {
    private final JdbcTemplate jdbc;
    private final ErpAccess access;
    private final TransactionTemplate tx;
    private final Path directory;
    private static final Set<String> TYPES=Set.of("application/pdf","image/png","image/jpeg","image/webp",
        "audio/webm","audio/ogg","audio/mpeg","audio/mp4","video/webm");
    public AttachmentController(JdbcTemplate jdbc,ErpAccess access,TransactionTemplate tx,
        @Value("${sos.upload-directory:/var/lib/syndicateos/uploads}") String directory) {
        this.jdbc=jdbc; this.access=access; this.tx=tx; this.directory=Path.of(directory).toAbsolutePath().normalize();
    }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID projectId,
        @RequestParam("file") MultipartFile file) throws IOException {
        String type=Objects.toString(file.getContentType(),"").split(";")[0].trim();
        if(file.isEmpty()||file.getSize()>10485760||!TYPES.contains(type)) throw ApiProblem.invalid("Upload a PDF, PNG, JPEG, WebP or audio recording up to 10 MB.");
        byte[] bytes=file.getBytes();
        if(type.equals("application/pdf")&&!new String(bytes,0,Math.min(5,bytes.length),java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")
            || type.equals("image/png")&&(bytes.length<8||bytes[0]!=(byte)137||bytes[1]!=80||bytes[2]!=78||bytes[3]!=71)
            || type.equals("image/jpeg")&&(bytes.length<3||bytes[0]!=(byte)255||bytes[1]!=(byte)216))
            throw ApiProblem.invalid("The file contents do not match its declared format.");
        UUID id=UUID.randomUUID();
        String name=Objects.toString(file.getOriginalFilename(),"attachment").replaceAll("[\\r\\n\\x00-\\x1F/\\\\]","_");
        if(name.length()>160) name=name.substring(name.length()-160);
        final String safeName=name;
        Path target=directory.resolve(id.toString());
        try {
            return tx.execute(status -> {
                access.attachmentProject(actor,projectId,"erp.submit",true);
                try {
                    Files.createDirectories(directory);
                    Files.write(target,bytes,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE);
                    try { Files.setPosixFilePermissions(target,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")); }
                    catch(UnsupportedOperationException ignored) { /* Windows development does not support POSIX permissions. */ }
                } catch(IOException e) { throw new ApiProblem(503,"ATTACHMENT_STORAGE_UNAVAILABLE","Private attachment storage is unavailable. Contact your administrator."); }
                jdbc.update("INSERT INTO sos.erp_attachments(id,project_id,uploaded_by,file_name,content_type,size_bytes) VALUES (?,?,?,?,?,?)",
                    id,projectId,actor.identityId(),safeName,type,bytes.length);
                return Map.of("id",id,"fileName",safeName,"contentType",type,"size",bytes.length);
            });
        } catch(RuntimeException e) { Files.deleteIfExists(target); throw e; }
    }
    @GetMapping("/{id}")
    public ResponseEntity<FileSystemResource> download(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID projectId,@PathVariable UUID id) {
        Map<String,Object> metadata=tx.execute(status -> {
            access.attachmentProject(actor,projectId,"erp.read",false);
            var rows=jdbc.queryForList("SELECT * FROM sos.erp_attachments WHERE id=? AND project_id=?",id,projectId);
            if(rows.isEmpty()) throw ApiProblem.denied();
            return rows.getFirst();
        });
        Path path=directory.resolve(id.toString());
        if(!Files.isRegularFile(path)) throw new ApiProblem(404,"ATTACHMENT_MISSING","Attachment file is unavailable. Contact your administrator.");
        return ResponseEntity.ok().header("Cache-Control","private, no-store")
            .header("X-Content-Type-Options","nosniff")
            .header("Content-Security-Policy","sandbox")
            .header("Content-Disposition",ContentDisposition.attachment().filename(metadata.get("file_name").toString(),java.nio.charset.StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.parseMediaType(metadata.get("content_type").toString())).body(new FileSystemResource(path));
    }
}
