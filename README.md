# demo311 Upload Image to the Cloud
It could not be any easier.  
From the phone's images ( gallery or snapped photos ) it does not require a native app ( ios or android ) in order to extract the following:
- what is the photo about graffiti , garbage , encampment ...
- what are the gps coordinates
- what is the street address  

Long a feature of android, and upcoming in IOS release 17 this fall, enables lightweight webapps to just point, shoot, and submit - AI and a couple cloud, API calls  automatically handle the rest. 	
 [Roboflow AI](https://roboflow.com/models/classification) classifies photos by type in an app context uploading media containing all the metadata needed to define org311 issues like graffiti or garbage. Organized for easy **learn to code** experience using an interactive notebook format, this project also presents  a lightweight webapp front end, simple html providing photo uploads, parsing metadata out of the photo and classifying photos according to issue-type. When combined, these prototype features allow point-and-shoot pothole reporting - a complete capture of a org311 type issue takes place while reporting the issue is as simple as take a picture and submit it.  
## jupyter notebooks on Colab  
Notebooks provide mix of docs and special code-execution **cells**, allowing great access for total beginners to coding, python, and AI. Links below to a cloud feature called [colab](https://www.androidpolice.com/google-colab-explainer), a dashboard for running notebooks ( also see video clips helping understand how the notebooks work).    
[intro to media uploads](https://colab.research.google.com/github/rowntreerob/demo311/blob/master/photoUpld.ipynb) run this notebook, observing functions to get Address from metadata and to classify the photo with AI   
[how to use ](https://www.loom.com/share/7931a0a6a22041d889f41ffe8899e42c) the notebook above on Colab  
[python methods](https://colab.research.google.com/github/rowntreerob/demo311/blob/master/photUp_V2.ipynb) and more detail on functions from the intro demo  
[connect your DB](https://www.loom.com/share/bcdec71bf2a94cceba1ae2fc67be0606) from Mongo DB Atlas, store issues that you create in notebook sample 2 
