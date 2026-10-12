package com.syndicateos.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

/** One real vision request against a synthetic, non-customer image. Never prints credentials. */
@EnabledIfEnvironmentVariable(named="SOS_TEST_BLUEPRINT_AI",matches="true")
class BlueprintAiClientTest {
    @Test void actualVisionReadsTheSyntheticPlan() throws Exception {
        BufferedImage image=new BufferedImage(640,480,BufferedImage.TYPE_INT_RGB);
        fill(image,0,0,640,480,0xffffff);
        for(int i=0;i<4;i++) {
            int x=i%2==0?40:340,y=i<2?55:285;
            fill(image,x,y,260,3,0);fill(image,x,y+140,260,3,0);
            fill(image,x,y,3,140,0);fill(image,x+260,y,3,143,0);
            text(image,x+110,y+50,Integer.toString(i+1),5);
        }
        fill(image,20,215,600,50,0xdddddd);text(image,210,225,"30 FT ROAD",4);
        text(image,605,8,"N",3);
        var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);
        var result=new BlueprintAiClient(new ObjectMapper()).extract(bytes.toByteArray(),"image/png","synthetic-layout.png");
        BlueprintGeometry.validate(result,Set.of("1","2","3","4"),false);
        Set<String> numbers=new HashSet<>();result.path("plots").forEach(p->numbers.add(p.path("number").asText()));
        assertTrue(numbers.containsAll(Set.of("1","2","3","4")),"Real vision should recognize all four printed labels");
        boolean width=false;for(var road:result.path("roads")) if(road.path("widthFeet").asDouble()==30) width=true;
        assertTrue(width,"Printed 30 FT width should be read, not replaced by an invented width");
    }
    private static void fill(BufferedImage image,int x,int y,int w,int h,int rgb) {
        for(int px=x;px<x+w;px++) for(int py=y;py<y+h;py++) image.setRGB(px,py,rgb);
    }
    private static void text(BufferedImage image,int x,int y,String text,int scale) {
        // Bitmap glyphs avoid a system font manager dependency in the headless backend JVM.
        Map<Character,String> glyphs=Map.ofEntries(
            Map.entry('0',"01110/10001/10011/10101/11001/10001/01110"),
            Map.entry('1',"00100/01100/00100/00100/00100/00100/01110"),
            Map.entry('2',"01110/10001/00001/00010/00100/01000/11111"),
            Map.entry('3',"11110/00001/00001/01110/00001/00001/11110"),
            Map.entry('4',"00010/00110/01010/10010/11111/00010/00010"),
            Map.entry('F',"11111/10000/10000/11110/10000/10000/10000"),
            Map.entry('T',"11111/00100/00100/00100/00100/00100/00100"),
            Map.entry('R',"11110/10001/10001/11110/10100/10010/10001"),
            Map.entry('O',"01110/10001/10001/10001/10001/10001/01110"),
            Map.entry('A',"01110/10001/10001/11111/10001/10001/10001"),
            Map.entry('D',"11110/10001/10001/10001/10001/10001/11110"),
            Map.entry('N',"10001/11001/10101/10011/10001/10001/10001"));
        for(char c:text.toCharArray()) {
            String glyph=glyphs.get(c);
            if(glyph!=null) {
                String[] rows=glyph.split("/");
                for(int yy=0;yy<7;yy++) for(int xx=0;xx<5;xx++)
                    if(rows[yy].charAt(xx)=='1') fill(image,x+xx*scale,y+yy*scale,scale,scale,0);
            }
            x+=6*scale;
        }
    }
}
