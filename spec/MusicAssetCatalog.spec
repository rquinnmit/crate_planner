<concept_spec>
concept MusicAssetCatalog [TrackId]

purpose normalize and preserve track metadata and analysis features for a DJ’s library

principle after a track is registered, we look up its attributes and return the latest known metadata and features

state
a set of Tracks with
	a set of Tags
	a set of Features
	the date and time the song was registered

a set of Tags with
	an artistName String
	a songTitle String
	a songDuration Integer
	an optional genre String

a set of Features with
	a beatsPerMinute Float
	a musicalKey String
	a list of song Sections

actions
register(songPath: String)
requires the path to the song exists
effect adds the track to the library with extracted tags and features

unregister(id: TrackId)
requires the track with id exists in the library
effect removes the registration of the track

getAttributes(id: TrackId): (tags: Tags, features: Features)
requires the track exists
effect returns the attributes (tags and features) of a track

listCandidates(filter: Filter): (ids: Set<TrackId>)
requires true
effect returns a set of tracks matching the constraints of the filter

</concept_spec>